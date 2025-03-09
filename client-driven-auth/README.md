# client base auth
> ⚠️ 이 방식은 xss 공격에 취약하여 추천하는 방식이 아닙니다.

- cookie를 사용하지 않고 api 요청 응답으로 인증 구현
  - `/auth/login` - 로그인 정보로 access, refresh token 반환
  - client 에서 토큰 관리
    - refresh token local storage 또는 cookie 저장
