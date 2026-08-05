# 222.place 앱 구조 및 질문 체계 분석

## 1. 조사 범위와 확정 결론

- 분석 원본: iPhone 화면 녹화 26분 13초, 1180×2556, 약 60fps
- 분석 방식: 10초 간격 전체 구조 확인, 2초 간격 686개 프레임 OCR, 빠른 전환 구간 1초 간격 재검증
- 녹화 범위: 이미 가입된 계정에서 프로필·구독·소셜 기능을 둘러본 뒤 핵심 큐레이션 질문 전체와 초대 선호 질문을 진행
- 녹화에서 확인된 고유 질문: 총 93개
  - 핵심 큐레이션 질문 85개
  - 초대 선호 질문 7개
  - 설문 경험 피드백 1개
- 별도의 사진 업로드 단계 1개가 있으나 질문 수에는 포함하지 않음
- 가입 전 이름·전화번호·인증 단계는 이번 녹화에 포함되지 않아 총 가입 필드 수에서는 제외

중요한 결론은 222가 질문 수를 줄인 것이 아니라, 많은 질문에 뒤로가기·건너뛰기·자동 저장을 허용해 전부 답해야 한다는 느낌을 줄인다는 점이다. 실제 질문 은행은 매우 크지만, 완료율을 프로필 정교화 수준으로 표현한다. 녹화에서는 대량의 질문을 통과한 뒤에도 Curation Profile이 85%로 표시됐다.

## 2. 앱의 핵심 구조

### 2.1 탐색형 서비스가 아니라 초대형 큐레이션 서비스

222의 첫 화면은 행사 목록이 아니라 도시 지도와 두 가지 진입점이다.

- meet new people: 새로운 사람을 만나는 경험
- see friends only: 기존 지인 중심 경험

사용자가 행사 목록을 검색해 고르는 전통적인 모임 플랫폼이 아니다. 프로필과 질문 데이터로 사람·장소를 조합한 뒤 초대를 보내고, 사용자는 초대를 수락하거나 거절한다. Invites 화면에는 거절한 초대를 다시 보는 기능도 있다.

### 2.2 하단 정보구조

- People: 인맥·서클 관리
- Create 또는 중심 플러스 버튼: 새로운 연결·행동 진입
- Invites: 큐레이션된 경험 초대
- 프로필 진입: 커버 사진, 큐레이션 유형, 완성도, 구독·추천 링크

### 2.3 관계 그래프

- 연락처와 222 가입자를 구분해 보여줌
- 지인을 초대하고 서클에 추가
- 관계별 activities, thoughts 기록
- 관계 제거, 활동 숨김, 차단
- 상위 9명의 가까운 사람을 시각적 카드로 구성

222는 낯선 사람 매칭만 하는 것이 아니라 기존 사회관계 데이터를 추천 신호로 활용하려는 구조다.

### 2.4 Memories

참여한 경험마다 공유 앨범을 만들고 참석자가 사진을 모은다. 경험 후 다시 만나고 싶은 상대를 묻고, 얼굴이 잘 보이는 프로필 사진을 요구한다. 오프라인 경험을 일회성 결제로 끝내지 않고 관계·사진·기억 자산으로 축적한다.

### 2.5 Curation Profile

- 성향 라벨 예시: S. romantic
- 전체 완성도 백분율
- ALL, IDENTITY, INTERESTS, MEDIA 탭
- background, content, friends, going out, interests, movies & shows, preferences 등 모듈별 완성도
- 핵심 질문 완료 전 일부 결과 잠금

질문을 설문지가 아니라 사용자가 키우는 프로필 자산처럼 보이게 만든다.

### 2.6 수익 모델

녹화에서 보인 구독 옵션은 다음과 같다.

- 1개월: £16.22/월
- 3개월: 총 £46.22, 월 환산 £15.40
- 연간: 총 £92.22, 월 환산 £7.68

혜택은 큐레이션 수수료 면제와 티켓 경험 할인이다. 즉 구독료와 개별 경험 매출을 결합하되, 구독자는 반복 큐레이션 비용을 내지 않는 구조다.

## 3. 질문 UI 설계

- 화면당 질문 하나
- 화면 상단에 카테고리명과 얇은 진행선만 표시
- 질문 번호와 남은 개수를 노출하지 않음
- 답변 즉시 자동 저장
- 왼쪽 아래 뒤로가기, 오른쪽 아래 다음 또는 skip
- 소문자 세리프 글꼴, 짙은 녹색 배경, 저채도 색상
- 7점 척도, 5점 척도, 단일선택, 복수선택, 검색형 선택, 태그 입력, 자유서술을 혼합
- 긴 질문군 사이에 카테고리 전환 화면을 넣어 심리적 구획을 만듦
- 민감한 질문도 장문의 설명보다 앞뒤의 일관된 형식으로 빠르게 통과시킴

## 4. 질문 전체 목록

표의 선택지는 녹화에서 확인된 원문을 기준으로 정리했다. 국가·학교·스포츠팀·TV 프로그램·팟캐스트처럼 외부 데이터베이스를 검색하는 항목은 고정 목록 대신 검색형으로 표기한다.

### Preferences / Music

| # | English original | 한국어 번역 | 답변 방식과 선택지 |
|---:|---|---|---|
| 1 | I enjoy discussing politics and the news. | 나는 정치와 뉴스에 관해 이야기하는 것을 즐긴다. | 1~7점, strongly disagree ↔ strongly agree |
| 2 | I like social media. | 나는 소셜미디어를 좋아한다. | 1~7점, strongly disagree ↔ strongly agree |
| 3 | When eating with friends, I don't mind if they're on their phones. | 친구들과 식사할 때 친구들이 휴대폰을 보고 있어도 상관없다. | 1~7점, so rude ↔ totally fine |
| 4 | What pet(s) do you have or really want? | 현재 키우거나 정말 키우고 싶은 반려동물은 무엇인가요? | 복수선택·건너뛰기. dog, cat, fish, guinea pig, rabbit, lizard, turtle, snake, horse, hermit crab 등 |
| 5 | Would you rather listen to Kanye West or Taylor Swift? | 칸예 웨스트와 테일러 스위프트 중 누구의 음악을 듣겠어요? | 단일선택: Kanye West, Taylor Swift, neither |
| 6 | Which of the following comedians do you find funny? | 다음 중 재미있다고 생각하는 코미디언은 누구인가요? | 최소 1명 복수선택. Dave Chappelle, Amy Schumer, Kevin Hart, Druski, Ali Wong, John Mulaney, Nikki Glaser, Hasan Minhaj, Shane Gillis, Trevor Noah, Hannah Gadsby, Bill Burr, Bo Burnham, Andrew Schulz, Tina Fey, Norm Macdonald |
| 7 | Which of the following comedians do you NOT find funny? | 다음 중 재미없다고 생각하는 코미디언은 누구인가요? | Q6과 같은 명단에서 복수선택 |
| 8 | Describe some traits of the people you'd like to meet. | 만나고 싶은 사람들의 특징을 설명해주세요. | 자유서술·건너뛰기. 구체적인 언어·취미·성격 조합을 쓰도록 예시 제공 |
| 9 | What type of music do you listen to? | 어떤 종류의 음악을 듣나요? | 최소 3개 복수선택. alternative/indie, classical/instrumental, country, jazz, pop, classic rock, heavy metal, electronic, hip-hop/rap, trap/drill, R&B, reggae, reggaeton, top 40/what's on the radio, I don't really care |
| 10 | Would you rather listen to rock or rap? | 록과 랩 중 무엇을 듣겠어요? | 단일선택: rock, rap, neither |

### Traits

| # | English original | 한국어 번역 | 답변 방식과 선택지 |
|---:|---|---|---|
| 11 | I see myself as someone who tends to be lazy. | 나는 스스로를 게으른 편인 사람이라고 생각한다. | 1~5점, strongly disagree ↔ strongly agree |
| 12 | I see myself as someone who is artistic. | 나는 스스로를 예술적인 사람이라고 생각한다. | 1~5점, strongly disagree ↔ strongly agree |
| 13 | I would sacrifice my own wellbeing to help a friend. | 친구를 돕기 위해 내 안녕을 희생할 수도 있다. | 1~7점, strongly disagree ↔ strongly agree |
| 14 | One of my core character traits is a desire to learn new things. | 새로운 것을 배우려는 욕구는 내 핵심 성격 중 하나다. | 1~7점, strongly disagree ↔ strongly agree |
| 15 | I find it easy to get close to people. | 나는 사람들과 가까워지는 것이 쉽다. | 1~7점, not at all me ↔ completely me |
| 16 | I tend to have an easy time finding romantic partners who are interested in me. | 나에게 관심을 보이는 연애 상대를 찾는 편이 쉽다. | 1~7점, not at all me ↔ completely me |
| 17 | I find it hard to depend on others. | 나는 다른 사람에게 의지하기 어렵다. | 1~7점, not at all me ↔ completely me |
| 18 | I find that people are always there when you need them. | 필요할 때 주변 사람들이 늘 곁에 있다고 느낀다. | 1~7점, not at all me ↔ completely me |
| 19 | I worry that other people don't really love me. | 다른 사람들이 나를 진심으로 사랑하지 않을까 걱정한다. | 1~7점, not at all me ↔ completely me |
| 20 | How often do you feel lonely? | 얼마나 자주 외로움을 느끼나요? | 1~7점, never ↔ every day |
| 21 | Are you a night owl or early bird? | 올빼미형인가요, 아침형인가요? | 1~7점, nocturnal ↔ 5am club |
| 22 | Does your advice tend to be more logical or emotional? | 조언할 때 논리적인 편인가요, 감정적인 편인가요? | 1~7점, pure logic ↔ right from the heart |
| 23 | Are you the one who organizes plans for friends? | 친구들의 약속을 주도해서 잡는 편인가요? | 단일선택: 자주 주도한다 / 좋아하지만 다른 사람에게 맡길 때가 많다 / 좋아하지 않고 거의 하지 않는다 |
| 24 | How late do you tend to show up to social events? | 모임에 보통 얼마나 늦게 도착하나요? | 1~7점, early bird ↔ always late |
| 25 | People tend to like me on first impression. | 사람들은 첫인상에서 나를 좋아하는 편이다. | 1~7점, I'm an acquired taste ↔ I'm anyone's cup of tea |
| 26 | I felt bullied when I was younger. | 어릴 때 괴롭힘을 당했다고 느꼈다. | 1~7점, not at all ↔ very often |
| 27 | Do you have any tattoos? | 문신이 있나요? | 단일선택: 없고 앞으로도 안 할 것 / 없지만 언젠가 할 수도 있음 / 하나 / 작은 문신 여러 개 / 큰 문신 여러 개 |
| 28 | How often do your first dates lead to a second date? | 첫 데이트가 두 번째 데이트로 이어지는 빈도는 어느 정도인가요? | 1~7점, very rarely ↔ almost always |
| 29 | I'm picky about who I surround myself with. | 나는 가까이 지낼 사람을 까다롭게 고르는 편이다. | 1~7점, I'm easygoing ↔ only the best |
| 30 | Romantically, how often do you find yourself thinking, “they're great but not for me”? | 연애에서 “좋은 사람이지만 내 사람은 아니다”라고 얼마나 자주 생각하나요? | 1~7점, never ↔ always |

### Values / Going out

| # | English original | 한국어 번역 | 답변 방식과 선택지 |
|---:|---|---|---|
| 31 | How important to you is humor? | 유머는 얼마나 중요한가요? | 4단계: not important at all, not important, important, very important |
| 32 | How important to you is family? | 가족은 얼마나 중요한가요? | 동일한 4단계 |
| 33 | How important to you is wealth? | 경제적 부는 얼마나 중요한가요? | 동일한 4단계 |
| 34 | How important to you is physical attraction? | 외적 매력은 얼마나 중요한가요? | 동일한 4단계 |
| 35 | How important to you is independence? | 독립성은 얼마나 중요한가요? | 동일한 4단계 |
| 36 | I enjoy spending time in loud social settings. | 나는 시끌벅적한 사교 환경에서 시간을 보내는 것을 즐긴다. | 1~7점, strongly disagree ↔ strongly agree |
| 37 | How spontaneous are you when making plans to go out? | 외출 약속을 잡을 때 얼마나 즉흥적인가요? | 1~7점, at least a week's notice ↔ text me and I'm there |
| 38 | What type of music do you like on a night out? | 외출한 밤에는 어떤 음악을 좋아하나요? | 최소 1개 복수선택. Q9와 유사한 장르 목록 |

### Self

| # | English original | 한국어 번역 | 답변 방식과 선택지 |
|---:|---|---|---|
| 39 | How attractive do you consider yourself? | 자신이 얼마나 매력적이라고 생각하나요? | 1~10점, not attractive at all ↔ extremely attractive |
| 40 | How intelligent do you consider yourself? | 자신이 얼마나 지적이라고 생각하나요? | 1~10점, not the brightest ↔ Einstein |
| 41 | Do you consider yourself “math smart”? | 자신이 수학적으로 똑똑하다고 생각하나요? | 단일선택: math isn't really my thing / I'm ok at it / I did well in school, but had to study / I'm a natural |
| 42 | Do you consider yourself “street smart”? | 자신이 세상 물정에 밝다고 생각하나요? | 단일선택: I can be a bit naive / smart enough to avoid a ripoff / I can handle anything |
| 43 | What religious affiliation(s) do you identify with? | 어떤 종교적 정체성을 가지고 있나요? | 최소 1개 복수선택. agnostic, atheist, buddhist, christian, hindu, jain, jewish, muslim, zoroastrian, sikh, spiritual, other, prefer not to say |
| 44 | What ethnicity(s) do you identify with? | 어떤 민족적 정체성을 가지고 있나요? | 최소 1개 복수선택. white/caucasian, black, latino/hispanic/spanish origin, middle eastern/north african, african, east asian, southeast asian, south asian, native hawaiian/pacific islander, native american, mixed race, other |
| 45 | What is your sexual orientation? | 성적 지향은 무엇인가요? | 단일선택: heterosexual, homosexual, bisexual, pansexual, other |
| 46 | What is your Instagram handle? | 인스타그램 아이디는 무엇인가요? | 자유입력·건너뛰기. 라이프스타일·정체성·기존 연결 이해에 사용한다고 고지 |

### Professional

| # | English original | 한국어 번역 | 답변 방식과 선택지 |
|---:|---|---|---|
| 47 | What is your LinkedIn profile URL? | 링크드인 프로필 URL은 무엇인가요? | URL 자유입력·건너뛰기. 교육·직업·포부 이해에 사용한다고 고지 |
| 48 | Which university(s), if any, did/do you attend? | 다녔거나 재학 중인 대학교가 있다면 어디인가요? | 대학교 데이터베이스 검색·복수 추가 |
| 49 | I enjoy talking about work when meeting new people. | 새로운 사람을 만날 때 일 이야기를 하는 것을 즐긴다. | 1~7점, strongly disagree ↔ strongly agree |
| 50 | Select any student groups you were part of in school. | 학교에서 참여했던 학생 단체를 선택해주세요. | 복수선택·건너뛰기. fraternity/sorority, a cappella, sports, music, volunteering, debate, politics, religion |
| 51 | What industry do you work in? | 어떤 업계에서 일하나요? | 단일선택. not working, healthcare, technology, manual labor, retail, food services, arts, politics, social services, academia/research, real estate, business owner 등 |
| 52 | What's the highest level of education you've completed? | 최종 학력은 무엇인가요? | less than high school, high school, associate's, bachelor's, master's, professional doctorate, PhD |
| 53 | How well do/did you do in school? | 학교 성적은 어느 정도였나요? | 3.7–4.0, 3.0–3.7, 2.0–3.0, below 2.0 |

### Perspectives

| # | English original | 한국어 번역 | 답변 방식과 선택지 |
|---:|---|---|---|
| 54 | What do you think about astrology? | 점성술에 대해 어떻게 생각하나요? | 단일선택: 가짜라서 싫다 / 가짜지만 이야기 소재로는 재미있다 / 어느 정도 맞지만 진지하게 믿지는 않는다 / 진짜이며 매일 운세를 본다 |
| 55 | Social activism is incredibly important for me. | 사회운동은 나에게 매우 중요하다. | 1~7점, strongly disagree ↔ strongly agree |
| 56 | I believe comedy is becoming too politically correct. | 코미디가 지나치게 정치적 올바름을 의식하게 됐다고 생각한다. | 1~7점, no, it's fine ↔ yes, it's too much |
| 57 | Do you like meeting people on the other side of the political spectrum as you? | 나와 정치적 성향이 반대인 사람을 만나는 것을 좋아하나요? | 단일선택: 다른 견해를 좋아함 / 무관심 / 선호하지 않음 / 강하게 싫어함 |
| 58 | Humans should make an active effort to curb the emission of greenhouse gases. | 인간은 온실가스 배출을 줄이기 위해 적극적으로 노력해야 한다. | 1~7점, strongly disagree ↔ strongly agree |
| 59 | Before the 3rd month of pregnancy, abortion for any reason is morally permissible. | 임신 3개월 이전의 임신중지는 이유와 관계없이 도덕적으로 허용될 수 있다. | 1~7점, strongly disagree ↔ strongly agree |
| 60 | Which political view(s) do you identify with? | 자신의 정치적 성향은 무엇인가요? | 최소 1개 복수선택. apolitical, moderate, moderate-left, moderate-right, far-left, far-right, libertarian, anarchist |
| 61 | How much do you agree with the Supreme Court's recent decision to repeal affirmative action? | 미국 연방대법원의 적극적 우대조치 폐지 결정에 얼마나 동의하나요? | 1~7점, strongly disagree ↔ strongly agree |

### Background

| # | English original | 한국어 번역 | 답변 방식과 선택지 |
|---:|---|---|---|
| 62 | What language(s) do you speak fluently? | 유창하게 구사하는 언어는 무엇인가요? | 최소 1개 복수선택. 영어·아랍어·벵골어·광둥어·네덜란드어·페르시아어·프랑스어·독일어·힌디어·이탈리아어·일본어·한국어·중국어·포르투갈어·펀자브어·러시아어·스페인어·태국어·튀르키예어 등 |
| 63 | I am a(n) ___ child. | 나는 형제자매 중 어떤 위치인가요? | 단일선택: oldest, middle, youngest, only |
| 64 | What country are you from? | 어느 나라 출신인가요? | 국가 전체 목록 단일선택 |
| 65 | What is your hometown? | 고향은 어디인가요? | 자유입력 |
| 66 | What is your immigration history? | 본인 또는 가족의 이민 배경은 어떻게 되나요? | I'm an immigrant / my parents are immigrants / my grandparents are immigrants / no recent immigration history |
| 67 | What financial situation did you grow up in? | 성장기의 경제적 환경은 어떠했나요? | 선택·건너뛰기: working class, middle class, upper class, ultra-wealthy |
| 68 | Which countries have you lived in or traveled to? | 거주하거나 여행한 국가는 어디인가요? | 국가 검색형 복수 태그, 최소 1개 |
| 69 | What is a fun or interesting fact you'd want your 222 group to know about you? | 222 그룹에게 알려주고 싶은 재미있거나 흥미로운 사실은 무엇인가요? | 짧은 자유서술. 히치하이킹·헬리콥터 조종 예시 제공 |
| 70 | Describe yourself in a few sentences. | 자신을 몇 문장으로 설명해주세요. | 자유서술·건너뛰기. 사람과 장소 큐레이션에 사용한다고 고지 |

### Interests / Media

| # | English original | 한국어 번역 | 답변 방식과 선택지 |
|---:|---|---|---|
| 71 | I enjoy spending time in nature. | 나는 자연에서 시간을 보내는 것을 즐긴다. | 1~7점, strongly disagree ↔ strongly agree |
| 72 | I enjoy ___ with friends. | 나는 친구들과 ___ 하는 것을 즐긴다. | 최소 1개 복수선택. artistic activities, bars, clubs, community service, concerts, exercise/sports, house parties, just vibing, museums, music festivals, outdoor activities, picnics, spiritual activities |
| 73 | What hobbies are you into? | 어떤 취미를 즐기나요? | 최대 5개 검색·자유 태그. 의미 유사도 알고리즘을 설명하고 niche한 답을 권장 |
| 74 | What are your favorite interests? / Things you enjoy learning or talking about | 가장 관심 있는 주제, 배우거나 이야기하기 좋아하는 것은 무엇인가요? | 최대 5개 검색·자유 태그. sustainable fashion, paleo diets, afrofuturism, online dating, water conservation, color psychology 등 추천 |
| 75 | What sports do you watch? | 어떤 스포츠를 시청하나요? | 최소 1개 복수선택. basketball, football, soccer, baseball, hockey, golf, tennis, boxing/MMA, esports, X-games |
| 76 | What sports teams do you follow? | 응원하거나 팔로우하는 스포츠팀은 어디인가요? | 스포츠팀 데이터베이스 검색·복수 추가 |
| 77 | What's an activity or place you've been meaning to check out or try in your city? | 사는 도시에서 가보거나 해보고 싶었던 활동 또는 장소는 무엇인가요? | 자유서술·건너뛰기. axe throwing, dinner at Carbone, techno in Brooklyn 예시 |
| 78 | What are your favorite TV shows? | 가장 좋아하는 TV 프로그램은 무엇인가요? | 프로그램 데이터베이스 검색, 최대 3개 |
| 79 | What are your favorite podcasts? | 가장 좋아하는 팟캐스트는 무엇인가요? | 팟캐스트 데이터베이스 검색·복수 추가 |

### Substances

| # | English original | 한국어 번역 | 답변 방식과 선택지 |
|---:|---|---|---|
| 80 | I enjoy drinking with friends. | 친구들과 술을 마시는 것을 즐긴다. | 1~7점, never ↔ almost always |
| 81 | I enjoy vaping with friends. | 친구들과 베이핑하는 것을 즐긴다. | 1~7점, never ↔ almost always |
| 82 | I enjoy smoking cigarettes with friends. | 친구들과 담배 피우는 것을 즐긴다. | 1~7점, never ↔ almost always |
| 83 | I enjoy using marijuana with friends. | 친구들과 마리화나를 사용하는 것을 즐긴다. | 1~7점, never ↔ almost always |
| 84 | I enjoy using psychedelics with friends. | 친구들과 환각제를 사용하는 것을 즐긴다. | 1~7점, never ↔ almost always |
| 85 | I enjoy using cocaine with friends. | 친구들과 코카인을 사용하는 것을 즐긴다. | 1~7점, never ↔ almost always |

### Account / Invite preferences

질문 85 이후에는 얼굴이 잘 보이는 사진을 올리는 별도 단계가 나온다. “경험 후 상대가 다시 보고 싶은지 물을 때 얼굴을 기억하게 해준다”는 이유를 설명하며 카메라 촬영 또는 사진 보관함 업로드를 제공한다.

| # | English original | 한국어 번역 | 답변 방식과 선택지 |
|---:|---|---|---|
| 86 | Outside of my age range, I'm also okay with meeting people at my table who are… | 기본 연령 범위 밖에서도 함께 앉아도 괜찮은 사람은 누구인가요? | 복수선택·건너뛰기: 3+ years older than me, 3+ years younger than me. 기본적으로 3~4세 이내를 만난다고 안내 |
| 87 | Is there any cuisine you would prefer NOT to eat? | 피하고 싶은 음식 종류가 있나요? | 최소 1개 복수선택. I'm ok with everything, American, Chinese, French, Italian, Indian, Korean, Mediterranean, Mexican, sushi, Thai, Vietnamese 등 |
| 88 | Do you have any of the following dietary restrictions? | 다음 중 해당하는 식이 제한이 있나요? | 복수선택·건너뛰기: vegan, vegetarian, gluten-free |
| 89 | What are you hoping to get out of your 222 experiences? | 222 경험에서 무엇을 얻고 싶나요? | 최소 1개 복수선택: meet new people, make new friends, find a short-term relationship, find a long-term relationship, explore new places, explore new restaurants, not sure |
| 90 | How much are you willing to spend on dinner on a night out with friends? | 친구들과 저녁 외식에 어느 정도 지출할 의향이 있나요? | 단일선택: $, $$, $$$, $$$$, $$$$$ |
| 91 | What price range of experiences would you prefer being invited to? | 어떤 가격대의 경험에 초대받고 싶나요? | 단일선택: up to ~$20.22, ~$30.22, ~$40.22, ~$60.22, ~$80.22, ~$100.22 |
| 92 | How did you hear about 222? | 222를 어떻게 알게 됐나요? | 단일선택: Instagram account, word of mouth, Google search, Twitter, Reddit, text invite, Google ad, TikTok |
| 93 | Feel free to offer any general feedback on the survey experience. | 설문 경험에 대한 전반적인 의견을 자유롭게 남겨주세요. | 자유서술 |

## 5. 질문이 실제로 수집하는 신호

### 사람 간 궁합

- Big Five에 가까운 성향: 게으름, 예술성, 호기심
- 애착과 관계 안정성: 친밀감, 의존, 사랑받지 못할 불안, 외로움
- 사회적 역할: 약속 주도, 시간 엄수, 첫인상, 사람을 고르는 기준
- 연애 시장 자기인식: 매력·지능 자평, 데이트 지속률, 상대 선택성

### 대화 소재와 문화적 유사성

- 음악·코미디·TV·팟캐스트
- 취미와 관심사를 자유 태그로 수집
- 정치·점성술·사회운동·기후·임신중지·적극적 우대조치
- 단순히 같은 답을 고른 사람만 묶지 않고 자유 태그의 의미 유사도까지 분석한다고 명시

### 실제 모임 운영 조건

- 시끄러운 장소 선호와 즉흥성
- 친구와 하는 활동
- 스포츠·팀·가보고 싶은 장소
- 음주·흡연·약물 경험
- 음식 기피·식이 제한·예산·허용 연령대

### 사회적 배경과 신분 단서

- 학력·대학교·업종·학교 성적
- 종교·민족·성적 지향·이민 배경·성장기 경제계층
- Instagram과 LinkedIn을 통한 외부 정체성 보강

## 6. 222 구조의 강점

1. 질문을 비용이 아니라 프로필 자산으로 바꾼다. 완성도와 모듈별 프로필을 보여줘 추가 응답 동기를 만든다.
2. 목록 탐색을 제거한다. 선택 피로를 줄이고 서비스가 사람과 장소를 책임지고 고른다는 약속을 선명하게 만든다.
3. 모임 이후의 관계를 제품 안에 남긴다. 재회 의사, 사진, memories, 서클이 다음 추천 데이터가 된다.
4. 자유서술과 태그를 적극 사용한다. 고정 객관식만으로는 잡기 어려운 미세한 취향을 수집한다.
5. 운영 조건과 사람 궁합을 분리한다. 성향 점수만으로 식당·활동을 정하지 않고 예산·음식·장소·물질 사용 등을 따로 수집한다.
6. 민감한 질문에도 대부분 skip을 제공한다. 질문 은행은 크지만 강제 설문처럼 느껴지지 않게 한다.

## 7. 약점과 한국화 시 주의점

1. 미국 중심 질문이 많다. Kanye/Taylor, 미국 코미디언, affirmative action 판결은 한국에서 그대로 작동하지 않는다.
2. 민감정보 범위가 과도하다. 종교·민족·성적 지향·정치·이민·경제계층을 매칭에 쓰면 한국 개인정보 보호와 차별 위험을 별도로 검토해야 한다.
3. 질문 피로가 사라진 것이 아니라 숨겨져 있다. 녹화상 전체 탐색은 20분 이상 걸렸다. 첫 모임 전에 전부 요구하면 전환율이 크게 떨어질 수 있다.
4. 사용자 자평 질문은 편향이 크다. 매력·지능·데이트 성공률은 실제 행동보다 자기 이미지에 가깝다.
5. Invite-only 구조는 큐레이션 품질이 낮을 때 선택권 부족으로 느껴진다. 초기에는 거절 사유와 재추천 속도가 중요하다.
6. 도시별 밀도가 필수다. 경험 목록을 숨기는 대신 정기적으로 좋은 초대를 보낼 충분한 공급이 있어야 한다.

## 8. 교집합에 적용할 한국화 방향

### 그대로 가져올 것

- 질문을 단계별로 저장하고 언제든 이어서 답하는 구조
- 한 화면에 질문 하나, 자동 저장, skip 허용
- 프로필 완성도와 관심 영역별 완성도
- 사람 궁합 질문과 운영 조건 질문의 분리
- 취미·관심사 자유 태그와 의미 기반 유사도
- 초대 수락·거절 및 거절 이유 학습
- 모임 후 다시 보고 싶은 사람과 공유 사진

### 한국식으로 바꿀 것

- LinkedIn·대학교·GPA 대신 직업 이야기 선호, 생활 리듬, 이동 가능 지역, 소비 성향 중심
- 민족·이민 질문 대신 성장 지역, 상경 여부, 현재 생활권처럼 실제 대화와 이동에 유효한 배경
- 미국 정치 문항 대신 논쟁 자체에 대한 선호와 다른 관점을 대하는 태도
- 약물 문항은 삭제하고 음주·흡연·논알코올 선호 정도만 운영 조건으로 제한
- TV·팟캐스트 데이터베이스를 한국 콘텐츠, 유튜브, 웹툰, 전시·공연으로 확장
- 음식 기피와 예산은 모임 신청 시점의 필수 조건으로 이동

### 권장 질문 단계

1. 가입 직후 5개: 모임 목적, 대화 에너지, 관심 콘텐츠, 피하고 싶은 조건, 일정·지역
2. 첫 초대 전 10~15개: 관계 성향, 모임 행동, 활동·음식·예산
3. 첫 참여 후 정교화: 누구와 편했는지, 어떤 순간이 좋았는지, 재회 의사
4. 선택형 프로필 확장: 문화취향·생활배경·자유태그

222를 한국화한다는 것은 93문항을 그대로 번역하는 것이 아니다. 핵심은 질문 은행을 크게 유지하되, 첫 전환에는 최소 질문만 사용하고 참여 데이터가 쌓일수록 프로필을 정교화하는 점진적 구조를 복제하는 것이다.

## 9. 최종 제품 구조 제안

교집합의 권장 구조는 다음과 같다.

가입 → 5문항 최소 프로필 → 날짜·지역 신청 → 큐레이션 대기 → 사람·코스 초대 → 수락·결제 → 순차 공개 → 현장 경험 → 재회 의사·피드백 → 다음 추천 정교화

행사 카탈로그를 전면에 두기보다 “이번 주 나를 위해 고른 초대”를 중심에 놓고, 사용자가 답한 질문과 실제 참여 결과가 다음 추천에 어떻게 반영됐는지 보여주는 것이 222 구조의 핵심을 가장 잘 옮기는 방법이다.
