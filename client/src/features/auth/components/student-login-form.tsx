import { LoginFormBase } from "./login-form-base";

interface Props {
  onSuccess?: () => void;
}

// Student authenticates with registrationNumber -> POST /auth/student/login
export function StudentLoginForm({ onSuccess }: Props) {
  return <LoginFormBase role="student" onSuccess={onSuccess} />;
}