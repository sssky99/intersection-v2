import Link from "next/link";

export const metadata = {
  title: "개인정보 처리방침 | 교집합",
  description: "교집합 개인정보 처리방침",
};

const sectionClass = "border-t border-black/10 pt-8";
const headingClass = "text-xl font-black tracking-tight text-black";
const paragraphClass = "mt-3 text-sm font-medium leading-7 text-black/65";
const listClass = "mt-3 list-disc space-y-2 pl-5 text-sm font-medium leading-7 text-black/65";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#f6f6f3] px-4 py-6 text-black sm:px-6 sm:py-10">
      <article className="mx-auto w-full max-w-3xl rounded-[28px] bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-xs font-bold text-black/55 transition hover:border-black/20 hover:text-black"
        >
          ← 교집합으로 돌아가기
        </Link>

        <header className="mt-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-black/35">
            privacy policy
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            개인정보 처리방침
          </h1>
          <p className="mt-4 text-sm font-semibold leading-7 text-black/55">
            교집합은 이용자의 개인정보를 중요하게 생각하며, 개인정보 보호법 등
            관계 법령을 준수합니다. 이 처리방침은 교집합 서비스에서 개인정보를
            어떤 목적으로 수집·이용하고 안전하게 관리하는지 안내합니다.
          </p>
          <div className="mt-5 rounded-2xl bg-black/[0.035] px-4 py-3 text-xs font-bold leading-6 text-black/50">
            시행일: 2026년 7월 12일 · 운영 주체: 교집합 · 대표자: 박동훈
          </div>
        </header>

        <div className="mt-10 space-y-10">
          <section className={sectionClass}>
            <h2 className={headingClass}>1. 개인정보의 처리 목적</h2>
            <p className={paragraphClass}>교집합은 다음 목적을 위해 개인정보를 처리합니다.</p>
            <ul className={listClass}>
              <li>카카오 로그인, 회원 식별 및 계정 관리</li>
              <li>프로필 생성, 성향 분석 및 모임 추천</li>
              <li>모임 신청, 참가자 배정, 티켓·멤버십·노쇼 방지비 관리</li>
              <li>채팅, 도착 확인, 피드백 및 블라인드 데이트 일정 조율</li>
              <li>이용자 문의, 안전 신고, 노쇼·부정 이용 및 분쟁 대응</li>
              <li>AI를 이용한 공개 프로필 소개 생성</li>
              <li>접속·이용행태 분석, 서비스 품질 개선 및 오류 대응</li>
              <li>별도 동의를 받은 경우 신규 모임·멤버십 등 광고성 정보 안내</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>2. 처리하는 개인정보 항목</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-y border-black/10 bg-black/[0.025] text-xs font-black text-black/50">
                    <th className="px-3 py-3">구분</th>
                    <th className="px-3 py-3">처리 항목</th>
                  </tr>
                </thead>
                <tbody className="font-medium leading-6 text-black/65">
                  <PolicyRow label="계정" value="Supabase 사용자 ID, 로그인 제공자, 카카오 식별자" />
                  <PolicyRow label="프로필" value="이름, 닉네임, 전화번호, 성별, 출생연도, MBTI, 프로필 사진, 공개 이모지·자기소개" />
                  <PolicyRow label="설문·추천" value="객관식·주관식 답변, 관심사, 직업·대화 성향, 추천 관련 점수" />
                  <PolicyRow label="모임 이용" value="신청 날짜, 티켓, 대기·배정·참가·도착 상태, 운영 메모, 멤버십 상태" />
                  <PolicyRow label="채팅·피드백" value="메시지 내용과 시각, 열람·삭제 상태, 별점, 추천 대상, 다시 만나고 싶은 사람, 부정 피드백과 사유" />
                  <PolicyRow label="블라인드 데이트" value="제안·응답 상태, 가능한 날짜, 확정 일정" />
                  <PolicyRow label="노쇼 방지비" value="입금·확인·환급 상태, 금액 및 처리 시각" />
                  <PolicyRow label="자동 수집" value="쿠키, 익명 세션 ID, 접속 경로, 리퍼러, 사용자 에이전트, 이용 이벤트와 접속 시각" />
                </tbody>
              </table>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>3. 개인정보의 처리 및 보유기간</h2>
            <p className={paragraphClass}>
              개인정보는 처리 목적이 달성되면 지체 없이 파기합니다. 다만 서비스 운영과
              분쟁 대응에 필요한 경우 아래 기간 내에서 보관하며, 관계 법령에 따른 보존
              의무가 있는 정보는 별도로 분리하여 보관합니다.
            </p>
            <ul className={listClass}>
              <li>회원·프로필 정보: 회원 탈퇴 후 1개월 이내</li>
              <li>채팅 기록: 모임 종료 후 최대 3개월</li>
              <li>일반 피드백: 처리 목적 달성 시 삭제, 수집일로부터 최대 3년</li>
              <li>노쇼·안전 신고 기록: 마지막 발생일부터 최대 3년</li>
              <li>블라인드 데이트 응답·일정 기록: 제안 종료 후 최대 3개월</li>
              <li>접속·행동분석 로그: 분석 목적 달성 시 삭제, 수집일로부터 최대 3년</li>
              <li>표시·광고 기록: 6개월</li>
              <li>계약·청약철회, 대금결제 및 서비스 공급 기록: 5년</li>
              <li>소비자 불만 또는 분쟁처리 기록: 3년</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>4. 다른 이용자에게 공개되는 정보</h2>
            <p className={paragraphClass}>
              교집합은 서비스 제공에 필요한 범위에서 같은 모임 참가자에게 다음 정보를
              공개할 수 있습니다.
            </p>
            <ul className={listClass}>
              <li>채팅 및 일반 모임 화면: 닉네임, 이름 일부를 가공한 표시명, 공개 이모지</li>
              <li>모임 종료 후 피드백 화면: 정확한 대상 확인을 위한 같은 모임 참가자의 실명</li>
              <li>공개 기간: 해당 모임 진행 및 피드백 작성에 필요한 기간</li>
            </ul>
            <p className={paragraphClass}>
              위 경우와 법령에 특별한 근거가 있는 경우를 제외하고, 교집합은 이용자의
              개인정보를 외부 제3자에게 제공하지 않습니다.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>5. 개인정보 처리업무의 위탁</h2>
            <p className={paragraphClass}>서비스 운영을 위해 다음 업체에 개인정보 처리업무를 위탁합니다.</p>
            <ul className={listClass}>
              <li>Supabase, Inc.: 로그인 인증, 데이터베이스 및 파일 저장</li>
              <li>Netlify, Inc.: 웹사이트 호스팅 및 서버 기능 제공</li>
              <li>OpenAI, L.L.C.: 이용자가 입력한 답변을 바탕으로 공개 프로필 문구 생성</li>
              <li>Microsoft Corporation: Microsoft Clarity를 통한 이용행태 분석</li>
              <li>Kakao Corp.: 카카오 로그인 및 비즈니스 채널 메시지 제공</li>
              <li>NAVER Cloud Corp.: 장소 검색 및 지도 표시</li>
            </ul>
            <p className={paragraphClass}>
              교집합은 위탁계약 또는 서비스 약관 등을 통해 목적 외 처리 금지, 보호조치,
              재위탁 및 감독에 필요한 사항을 확인합니다.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>6. 개인정보의 국외 이전</h2>
            <p className={paragraphClass}>
              아래 서비스 이용 과정에서 개인정보가 국외로 이전되거나 국외 사업자가
              원격으로 처리할 수 있습니다.
            </p>
            <ul className={listClass}>
              <li>Supabase: 데이터베이스·인증·저장, 대한민국 서울 리전 및 서비스 운영 국가</li>
              <li>Netlify: 웹 요청 처리와 호스팅, 미국 등 글로벌 인프라 운영 국가</li>
              <li>OpenAI: AI 공개 프로필 생성, 미국</li>
              <li>Microsoft Clarity: 이용행태 분석, 미국 등 Microsoft가 운영하는 국가</li>
            </ul>
            <p className={paragraphClass}>
              이전 항목은 계정 식별자, 프로필·설문 입력정보, 접속·이용행태 정보 중 해당
              서비스 제공에 필요한 정보입니다. 정보는 서비스 이용 시 암호화된 네트워크를
              통해 이전되며, 위탁 목적 달성 또는 계약 종료 시까지 각 업체의 정책과 법령에
              따라 처리됩니다. 국외 이전을 원하지 않는 이용자는 개인정보 문의 이메일을
              통해 처리 정지 또는 회원 탈퇴를 요청할 수 있으며, 이 경우 관련 기능 이용이
              제한될 수 있습니다.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>7. 개인정보의 파기</h2>
            <ul className={listClass}>
              <li>보유기간 경과 또는 처리 목적 달성 후 지체 없이 파기합니다.</li>
              <li>전자 파일은 복구·재생이 어렵도록 안전한 방법으로 삭제합니다.</li>
              <li>법령상 보존 정보는 다른 개인정보와 분리하여 보관합니다.</li>
              <li>종이 문서가 있는 경우 파쇄 또는 소각합니다.</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>8. 이용자의 권리와 행사 방법</h2>
            <p className={paragraphClass}>
              이용자는 자신의 개인정보에 대해 열람, 정정·삭제, 처리정지, 동의 철회 및
              회원 탈퇴를 요청할 수 있습니다. 아래 개인정보 문의 이메일로 요청하면 본인
              확인 후 관계 법령에 따라 처리합니다. 이미 삭제된 정보나 법령상 보존 의무가
              있는 정보는 요청이 제한될 수 있습니다.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>9. 가입 연령 기준</h2>
            <p className={paragraphClass}>
              교집합은 현재 1992년생부터 2007년생까지의 이용자를 대상으로 합니다. 가입
              화면에서 정한 출생연도 기준에 맞지 않는 가입이 확인되면 이용 제한과 개인정보
              삭제 절차를 진행할 수 있습니다.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>10. 쿠키 및 이용행태 정보</h2>
            <p className={paragraphClass}>
              교집합은 로그인 유지, 서비스 분석 및 화면 개선을 위해 쿠키, 로컬 스토리지,
              익명 세션 ID와 이용 이벤트를 사용할 수 있으며 Microsoft Clarity를 사용합니다.
              브라우저 설정에서 쿠키 저장을 거부하거나 삭제할 수 있으나 로그인 등 일부
              기능 이용이 제한될 수 있습니다.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>11. 광고성 정보 전송</h2>
            <p className={paragraphClass}>
              신규 모임, 멤버십 등 광고성 정보는 별도의 선택 동의를 받은 이용자에게만
              카카오톡 비즈니스 채널 등을 통해 전송합니다. 이용자는 언제든 수신을 거부할
              수 있으며, 수신 거부는 필수 서비스 안내에 영향을 주지 않습니다.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>12. 개인정보의 안전성 확보조치</h2>
            <ul className={listClass}>
              <li>개인정보 접근권한 최소화 및 관리자 접근통제</li>
              <li>전송구간 암호화 및 인증정보 보호</li>
              <li>접속기록 보관·점검과 데이터 접근 정책 적용</li>
              <li>개인정보 취급자 관리와 침해사고 대응절차 운영</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>13. 개인정보 보호책임자 및 문의</h2>
            <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-4 text-sm font-semibold leading-7 text-black/65">
              <p>운영 주체: 교집합</p>
              <p>대표자 및 개인정보 보호책임자: 박동훈</p>
              <p>사업자등록번호: 372-02-03755</p>
              <p>주소: 서울특별시 광진구 화양동 10-19</p>
              <p>
                이메일: {" "}
                <a className="underline underline-offset-4" href="mailto:intersection.official.2026@gmail.com">
                  intersection.official.2026@gmail.com
                </a>
              </p>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>14. 권익침해 구제 방법</h2>
            <ul className={listClass}>
              <li>개인정보침해신고센터: 국번 없이 118</li>
              <li>개인정보분쟁조정위원회: 1833-6972</li>
              <li>경찰청 사이버범죄 신고시스템: 182</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>15. 처리방침의 변경</h2>
            <p className={paragraphClass}>
              이 처리방침을 변경하는 경우 시행 전에 서비스 내 공지 등으로 안내합니다.
              결제 기능, 개인정보 처리업체 또는 공개 범위 등 중요한 사항이 변경되는 경우
              필요한 고지와 동의 절차를 진행합니다.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-black/8 align-top">
      <th className="w-28 px-3 py-3 font-black text-black/55">{label}</th>
      <td className="px-3 py-3">{value}</td>
    </tr>
  );
}
