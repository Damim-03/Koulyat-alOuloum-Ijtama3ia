import { LoginFormBase } from "./login-form-base";

interface Props {
  onSuccess?: () => void;
}

// Admin/Owner authenticates with email -> POST /auth/admin/login
export function AdminLoginForm({ onSuccess }: Props) {
  return <LoginFormBase role="admin" onSuccess={onSuccess} />;
}