# 스레드 ③ 손글씨 표와 도장 — 2026-10-02 (금) 20:00~21:00

화면 디테일 글. 영상이 주인공이라 본문은 짧게.

- **붙일 파일**: `docs/marketing/assets/threads-clip-matrix-stamp.mp4`
  (9.2초, 1080×1920, H.264. 손글씨 표가 그려지는 장면 5초 → 도장 장면 4.2초. 소리 없음)
- **주제 태그 (하나만)**: `1인개발`
- **금요일 저녁으로 둔 이유**: ①(월 저녁) ②(수 점심)와 요일을 바꿔 비교하려고

## 본문 (태그 포함 500자 이내)

```
결정 노트에서 제일 공들인 10초예요.

점수를 다 매기면 결과를 바로 보여주지 않고, 내가 매긴 점수를 손글씨 표로 한 번 그려서 돌려줘요.
새로 더하는 건 없어요. 내가 적은 것만요. 바쁘면 건너뛸 수도 있고요.

그다음 결과를 보고, 정했으면 도장을 찍어요.
원하면 30일 뒤에 그 결정이 어땠는지 한 번 물어봐요.

고민을 종이에 적으면 조금 가벼워지는 그 느낌을 앱에 옮기고 싶었어요.
```

## 첫 댓글

```
안드로이드 테스터 모으는 중이에요. 정식 출시 전이라 14일만 함께해 주시면 돼요.
참여 방법 → [①번 모집 글 링크]
```

## 사실 확인

| 문장 | 근거 |
|---|---|
| 결과 전에 손글씨 표로 되돌려줌, 새 정보 없음 | 기획안 4.1 단계 7 (Matrix), `src/screens/Matrix.tsx` |
| 건너뛸 수 있음 | 표 화면의 "그리는 건 건너뛰기" 버튼 (클립 앞부분에 보인다) |
| 도장, 30일 뒤 다시 물어보기 | `src/screens/Commit.tsx` ("30일 뒤에 다시 물어보기" 켜고 끄기) |
| "10초" | 클립 길이 9.2초 |

## 클립 만든 방법

`docs/promo/decision-note-promo.mp4`에서 두 구간을 이어 붙였다 (`scripts/promo/stage.html`의 `SEGMENTS`·`CAPTIONS` 기준).

- 19.40초~24.40초 (프레임 582~731) — 자막 "내가 매긴 표가 / 손글씨로 그려지고"가 써지기 직전부터 사라질 때까지
- 27.37초~31.60초 (프레임 821~947) — 마무리 화면이 들어오고 자막 "정했으면, 도장 쾅."이 써지기 시작할 때부터, 자막이 다 사라지고 폰이 내려가기 직전까지

두 자막 모두 원본에서 나타나고 사라지는 그대로라 중간에 끊기지 않는다.
원본 영상이 다시 만들어지면(`npm run promo`) 장면 시각이 바뀔 수 있으니 `SEGMENTS`를 다시 보고 자른다.

```bash
FF=$(python3 -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())")
$FF -i docs/promo/decision-note-promo.mp4 -f lavfi -i anullsrc=r=44100:cl=stereo -filter_complex \
  "[0:v]trim=start_frame=582:end_frame=732,setpts=PTS-STARTPTS[a];\
   [0:v]trim=start_frame=821:end_frame=948,setpts=PTS-STARTPTS[b];\
   [a][b]concat=n=2:v=1:a=0,fps=30,format=yuv420p[v]" \
  -map "[v]" -map 1:a -shortest -c:v libx264 -preset slow -crf 20 -profile:v high -level 4.0 \
  -pix_fmt yuv420p -c:a aac -b:a 64k -movflags +faststart -r 30 \
  docs/marketing/assets/threads-clip-matrix-stamp.mp4
```
