# simple sso
> localhost:3000 (idp server)
> test-a.com (client-a, admin/1234)
> test-b.com (client-b, user/1234)

- localhost에서 실행되지만 여러 도메인에서 테스트 하기위해 `/etc/hosts` 테스트 도메인을 추가하세요.
  - `127.0.0.1    test-a.com` 
  - `127.0.0.1    test-b.com`
- secure cookie를 사용하므로 https 환경에서 실행됩니다. certs 디렉토리에서 아래명령어를 실행하여 key 파일을 생성하세요.
  - `openssl req -x509 -newkey rsa:2048 -keyout private-key.pem -out certificate.pem -days 365 -nodes`
- `simple sso` 에서는 비교적 단순한 refresh 요청 에서만 same-site=None; 쿠키를 사용하기 때문에 csrf를 사용하지 않습니다.
  - 더 복잡한 처리에 대해 쿠키를 사용한다면 csrf를 고려하세요.

## csrf-token 적용해야 하는 이유

same-site=None;secure;으로 쿠키 만들면 모든 사이트에서 설정된 쿠키를 보내게 된다.
예를들면 a.com(인증서버 도메인), b.com(클라이언트)로 인증 처리를 하고자 한다.
b.com에서 a.com으로 인증하여 a.com에서 same-site=None;secure; 쿠키를 생성하면 b.com에서 a.com으로 요청할때 생성된 쿠키가 함께 포함되어 요청된다.
이때 해커가 c.com(악의적인 클라이언트)를 생성해두고 사용자가 위 인증과장을 거친후 c.com에 접속하면 문제가 발생할 수 있다.
same-site=None;secure; 적용이 되어있기 때문에 c.com에서 a.com으로 api 요청 했을때 쿠키가 포함된다.
즉, c.com에서도 인증이 처리가 된것처럼 api를 사용할수 있게 되는것이다.
이를 방지하기 위해 cors 정책을 설정(b.com 요청만 허용)하고, csrt-token(일반적으로 난수이며 유지기간을 짧게 설정)을 적용할수 있다.
b.com에서는 특정 api로 crsf-token을 발급받고 refresh와 같은 인증 요청을 할때 csrf-token을 전달한다.
c.com은 cors를 정책으로 인하여 csrf-token을 발급받을수 없고 csrf-token이 없는 해커는 refresh와 같은 인증 요청에 성공할수 없게 된다.
csrf-token을 사용하는 다른 이유로는 cors에 문제에 있다.
cors는 브라우저 보안정책으로 다른 origin에서 요청된 응답을 처리하지 않는것이다.
즉 cors만 설정한다면 요청에 대한 서버처리는 진행되며 브라우저가 응답만 처리하지 않기 때문에 delete 같은 요청을 할때 응답은 받지 않지만 서버에서 삭제 처리는 정상적으로 이루어지는것이 문제가 되는것이다.
(단, authorization 토큰으로 인증처리를 하는 api에 경우에는 불필요할 수 있다.)

## cookie

- cookie same-site 설정 / [브라우저-쿠키와-SameSite-속성](https://seob.dev/posts/%EB%B8%8C%EB%9D%BC%EC%9A%B0%EC%A0%80-%EC%BF%A0%ED%82%A4%EC%99%80-SameSite-%EC%86%8D%EC%84%B1/)
  - Strict - Cross-Site 요청에서 전송되지 않습니다.
  - Lax - (크롬을 비롯한 대부분 브라우저에서 default) 일부 조건에서 Cross-Site 요청에서 전송됩니다.
  - None - 모든 Cross-Site 요청에서 전송됩니다. 이 설정을 위해서는 `secure=True` 설정이 필요합니다.
  - ⚠️ 브라우저에서 fetch credential 같은 설정을하면 lax cookie가 전송 됩니다.


## enhancement

- 토큰 관리를 db에서 하면 서버를 재시작해도 인증 유지될것으로 예상 됩니다.


## refrence

- [NODE-📚-crypto-모듈-암호화](https://inpa.tistory.com/entry/NODE-📚-crypto-모듈-암호화)