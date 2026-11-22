import { LoginFormBase } from "./login-form-base";

interface Props {
  onSuccess?: () => void;
  /** Back from «نسيت كلمة المرور» with a password from the administration: this number, filled in. */
  recovered?: string;
}

// Student authenticates with registrationNumber -> POST /auth/student/login
export function StudentLoginForm({ onSuccess, recovered }: Props) {
  return <LoginFormBase role="student" onSuccess={onSuccess} recovered={recovered} />;
}
