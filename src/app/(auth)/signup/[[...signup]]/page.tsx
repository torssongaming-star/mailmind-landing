import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      path="/signup"
      signInUrl="/login"
      fallbackRedirectUrl="/app"
    />
  );
}
