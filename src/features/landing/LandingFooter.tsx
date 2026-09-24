"use client";

import { Instagram, X } from "lucide-react";
import { useRef } from "react";
import styles from "./LandingFooter.module.css";

export function LandingFooter() {
  const about = useRef<HTMLDialogElement>(null);

  return (
    <>
      <nav className={styles.footer} aria-label="교집합 안내">
        <button className={styles.button} onClick={() => about.current?.showModal()}>about</button>
        <div className={styles.row}>
          <a className={styles.button} href="https://pf.kakao.com/_xnweQn/chat" target="_blank" rel="noopener noreferrer">contact</a>
          <a className={`${styles.button} ${styles.social}`} aria-label="교집합 인스타그램 (새 창)" href="https://www.instagram.com/inter_section.official/" target="_blank" rel="noopener noreferrer"><Instagram size={19} strokeWidth={1.6} aria-hidden /></a>
        </div>
      </nav>
      <dialog ref={about} className={styles.dialog} aria-labelledby="landing-about-title" onClick={(event) => { if (event.target === event.currentTarget) about.current?.close(); }}>
        <div className={styles.titleRow}><h2 id="landing-about-title">교집합은 어떤 곳인가요?</h2><button aria-label="소개 닫기" onClick={() => about.current?.close()}><X size={19} /></button></div>
        <div lang="ko">
          <p><strong>교집합은 새로운 사람을 만나고, 그 만남을 이어갈 수 있도록 돕는 서비스입니다. 함께 가보고 싶은 곳, 다시 만나고 싶은 사람이 생겼으면 합니다.</strong></p>
          <p><strong>휴대폰을 보다 보면 생각보다 많은 시간이 지나갑니다. 그 시간 중 조금은 밖에서 사람을 만나고, 대화하며 보냈으면 좋겠습니다.</strong></p>
          <p><strong>같이 밥을 먹거나 어딘가에 가보면, 프로필만으로는 알 수 없던 모습을 알게 됩니다. 우리는 그런 만남을 준비합니다.</strong></p>
          <p><strong>계속 프로필을 넘기거나 먼저 DM을 보낼 필요는 없습니다. 어떤 사람과 잘 맞을지, 어디서 무엇을 할지 교집합이 고민하겠습니다.</strong></p>
          <p><strong>평소라면 만날 일이 없었을 사람과 한번 만나보세요. 다음에도 보고 싶은 사람이 생길지도 모르니까요.</strong></p>
        </div>
      </dialog>

    </>
  );
}
