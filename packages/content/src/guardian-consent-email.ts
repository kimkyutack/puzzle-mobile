export type GuardianMailStatus = 'queued'|'sending'|'sent'|'failed'|'unknown';

export function guardianConsentEmail(requestId:string,version:string,expiresAt:number) {
  const deadline=new Intl.DateTimeFormat('ko-KR',{
    dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul',
  }).format(expiresAt);
  const subject=`[구름정원] 법정대리인 동의 요청 ${requestId}`;
  const text=[
    '안녕하세요. 구름정원 운영사 히든스테이지입니다.',
    '아동이 구름정원을 이용하기 위해 법정대리인의 동의를 요청했습니다.',
    '',
    '수집·이용 목적: 보호자 동의 확인, 계정 관리, 퍼즐 진행과 정원 저장, 서비스 보안.',
    '처리 항목: 보호자 성명·이메일·동의 기록, 아동의 연령 구간, 게임 계정 ID·세션 정보, 퍼즐 및 정원 진행, 앱 설정, 서비스 접속·보안 기록.',
    '보유 기간: 요청 화면의 보호자 연락처는 요청 처리·만료 시 삭제됩니다. 동의 확인 기록과 서비스 이용 정보는 이용 및 동의 관리에 필요한 기간 동안 보관합니다. 계정 삭제 요청과 법령상 보관 대상은 개인정보처리방침에 따라 처리합니다.',
    '동의를 거부할 수 있습니다. 동의가 확인되지 않으면 아동은 온라인 게임을 시작하거나 계속할 수 없습니다.',
    '아동 계정에서는 광고, 스토어 결제, 외부 로그인, 친구·길드 등 소셜 기능을 제공하지 않습니다.',
    '동의 철회·열람·삭제 요청은 이 메일의 회신 주소로 보내 주세요.',
    '개인정보처리방침: https://hiddenstage.app/official/privacy',
    '',
    `회신 기한: ${deadline} (한국 시간)`,
    `요청 번호: ${requestId}`,
    `동의서 버전: ${version}`,
    '이 메일을 받은 주소에서 회신해 주세요. 동의하는 경우 “본인은 아동의 법정대리인이며, 위 내용을 읽고 개인정보 수집·이용에 동의합니다.”라고 적어 주세요. 동의하지 않는 경우 “동의하지 않습니다.”라고 적어 주세요.',
  ].join('\n');
  return {subject,text};
}
