import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin } from "./firebase/firebase";
import styles from "./LoginPage.module.css";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleGoogleLogin(event) {
    event.preventDefault();

    setIsSigningIn(true);
    setErrorMessage("");

    try {
      await adminLogin();
      navigate("/", { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Google sign-in failed. Try again.",
      );
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.kicker}>WörterHaus Login</p>
          <h1>Sign in with Google to access your vocabulary workspace.</h1>
          <p className={styles.description}>
            The app stays on <strong>/</strong>. This page is only for Google
            authentication.
          </p>
        </div>

        <form className={styles.card} onSubmit={handleGoogleLogin}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <p className={styles.helper}>
            Google sign-in is required. The email and password fields are shown
            for a familiar login form, but authentication happens through
            Google.
          </p>

          {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

          <button
            type="submit"
            className={styles.googleButton}
            disabled={isSigningIn}
          >
            {isSigningIn ? "Opening Google..." : "Continue with Google"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
