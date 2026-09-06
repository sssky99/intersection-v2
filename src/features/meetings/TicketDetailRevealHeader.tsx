"use client";


import { motion } from "framer-motion";

export function TicketDetailRevealHeader({
  title,
  meta,
}: {
  title: string;
  meta: string;
}) {
  return (
    <motion.header
      initial={{ y: "32vh" }}
      animate={{ y: 0 }}
      transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
      className="px-10 text-center"
    >
      <h1 className="font-ticket-latin whitespace-pre-line text-[30px] font-medium leading-[1.12] tracking-[-0.025em] text-[#24211d]">
        {meetingInvitationDisplayTitle(title)}
      </h1>
      <p className="font-ticket-latin mt-4 text-[13px] font-medium text-[#24211d]/75">
        {meta}
      </p>
    </motion.header>
  );
}


export function meetingInvitationDisplayTitle(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized === "디너 & 교집합 시크릿 아지트") {
    return "디너 &\n교집합 시크릿 아지트";
  }
  return normalized;
}
