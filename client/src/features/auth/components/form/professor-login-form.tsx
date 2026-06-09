import { LoginFormBase } from "./login-form-base";

interface Props {
  onSuccess?: () => void;
}

// Professor authenticates with universityEmail -> POST /auth/professor/login
export function ProfessorLoginForm({ onSuccess }: Props) {
  return <LoginFormBase role="professor" onSuccess={onSuccess} />;
}