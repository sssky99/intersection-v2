import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import { buildBoardInvitationMessage, friendGivenName } from "./friendInvitationMessage";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create table profiles(user_id uuid primary key,name text,gender text,photo_url text,archived_at timestamptz);
    create table ticket_instances(id uuid primary key,event_date date,visibility text);
    create table ticket_participations(user_id uuid,ticket_instance_id uuid,status text,arrival_status text);
    create table meeting_events(id uuid primary key,event_date date,visibility text);
    create table meeting_groups(event_id uuid,legacy_ticket_instance_id uuid,status text default 'confirmed');
  `);
  await db.exec(readFileSync("supabase/migrations/20260928080428_private_friend_boards_and_encounters.sql","utf8"));
  await db.exec(readFileSync("supabase/migrations/20260928080644_friend_candidates_event_visibility.sql","utf8"));
});
afterAll(async () => db.close());
beforeEach(async () => {
  await db.exec("truncate friend_boards,meeting_friend_encounters,meeting_groups,meeting_events,ticket_participations,ticket_instances,profiles,auth.users cascade");
  for(let n=1;n<=5;n++) {
    await db.query("insert into auth.users values($1)",[id(n)]);
    await db.query("insert into profiles(user_id,name,gender) values($1,$2,$3)",[id(n),`회원${n}`,n===3?"여성":"남성"]);
  }
  await db.query("insert into ticket_instances values($1,(now() at time zone 'Asia/Seoul')::date-1,'public'),($2,(now() at time zone 'Asia/Seoul')::date-1,'public')",[id(10),id(11)]);
  for(let n=1;n<=5;n++) await db.query("insert into ticket_participations values($1,$2,'approved',null)",[id(n),id(n===5?11:10)]);
  await db.query("insert into meeting_events values($1,(now() at time zone 'Asia/Seoul')::date-1,'public')",[id(20)]);
  await db.query("insert into meeting_groups(event_id,legacy_ticket_instance_id) values($1,$2),($1,$3)",[id(20),id(10),id(11)]);
});
const candidates = async () => (await db.query<{user_id:string}>("select * from friend_candidates($1,true)",[id(1)])).rows.map(r=>r.user_id);
const slots = (...numbers: number[]) => Array.from({length:9},(_,i)=>numbers[i]?{id:id(numbers[i]),x:50,y:50}:null);
it("returns same-sex same-table members only and excludes cancelled/no-show/archived",async()=>{
  expect(await candidates()).toEqual([id(2),id(4)]);
  await db.query("update ticket_participations set arrival_status='no_show' where user_id=$1",[id(2)]);
  await db.query("update profiles set archived_at=now() where user_id=$1",[id(4)]);
  expect(await candidates()).toEqual([]);
  await db.exec("update profiles set archived_at=null; update ticket_participations set status='cancelled'");
  expect(await candidates()).toEqual([]);
});
it("uses a calendar two-month boundary and only past Korean dates",async()=>{
  await db.exec("update ticket_instances set event_date=((now() at time zone 'Asia/Seoul')::date - interval '2 months')::date");
  expect(await candidates()).toHaveLength(2);
  await db.exec("update ticket_instances set event_date=event_date-1");
  expect(await candidates()).toEqual([]);
  await db.exec("update ticket_instances set event_date=(now() at time zone 'Asia/Seoul')::date");
  expect(await candidates()).toEqual([]);
});
it("includes confirmed operational draft tickets but never unpublished event groups",async()=>{
  await db.exec("update ticket_instances set visibility='draft'");
  expect(await candidates()).toHaveLength(2);
  await db.exec("update meeting_events set visibility='test_only'");
  expect(await candidates()).toEqual([]);
});
it("includes second-stage peers without exposing the whole event; deduplicates first-stage peers",async()=>{
  const members=[{userId:id(1),group:"RED"},{userId:id(2),group:"RED"},{userId:id(5),group:"RED"}];
  await db.query("select save_second_stage_groups($1,$2)",[id(20),JSON.stringify(members)]);
  expect(await candidates()).toEqual([id(2),id(4),id(5)]);
  await expect(db.query("select save_second_stage_groups($1,$2)",[id(20),JSON.stringify([{userId:id(1),group:"A"},{userId:id(1),group:"B"}])])).rejects.toThrow();
  expect((await db.query("select * from meeting_friend_encounters")).rows).toHaveLength(3);
});
it("rejects forged and duplicate friends, preserves an already-saved friend after expiry",async()=>{
  await expect(db.query("select save_friend_board($1,$2)",[id(1),JSON.stringify(slots(3))])).rejects.toThrow();
  await expect(db.query("select save_friend_board($1,$2)",[id(1),JSON.stringify(slots(2,2))])).rejects.toThrow();
  await db.query("select save_friend_board($1,$2)",[id(1),JSON.stringify(slots(2))]);
  await db.exec("update ticket_instances set event_date=(now() at time zone 'Asia/Seoul')::date-100");
  expect(await candidates()).toEqual([]);
  await db.query("select save_friend_board($1,$2)",[id(1),JSON.stringify(slots(2))]);
  await expect(db.query("select save_friend_board($1,$2)",[id(1),JSON.stringify(slots(2,4))])).rejects.toThrow();
  await db.query("select save_friend_board($1,$2)",[id(1),JSON.stringify(slots())]);
});
it("does not grant private board or seating access to client roles",async()=>{
  const result=await db.query<{allowed:boolean}>("select has_table_privilege('authenticated','friend_boards','select') or has_function_privilege('anon','friend_candidates(uuid,boolean)','execute') as allowed");
  expect(result.rows[0].allowed).toBe(false);
});
it("personalizes board SMS without dropping a two-character given name",()=>{
  expect(friendGivenName("수정")).toBe("수정");
  const text=buildBoardInvitationMessage({recipientName:"이진현",inviterName:"문하늘",eventDate:"2026-10-10",eventTime:"18:00",eventTitle:"교집합",invitationUrl:"https://example.com/invite/1"});
  expect(text).toContain("진현님, 하늘님이"); expect(text).toContain("https://example.com/invite/1");
});
