"use client";

import { useState, useRef, useEffect } from "react";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LogOut, Key, BookMarked, Tags } from "lucide-react";
import { useTranslations } from 'next-intl';
import { Link } from "@/i18n/routing";
import { buttonClass } from "@nakamura196/react-ui";

interface LoginButtonProps {
  user: User | null;
  loading: boolean;
}

export function LoginButton({ user, loading }: LoginButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const t = useTranslations('Auth');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setShowModal(false);
    } catch {
      // Error signing in with Google
      setError(t('googleLoginError'));
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setShowModal(false);
      setError("");
    } catch (error: unknown) {
      // Error with email auth
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(t('authError'));
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch {
      // Error signing out
    }
  };

  if (loading) {
    return (
      <div
        className="animate-pulse rounded-md bg-[var(--ds-surface-2)]
        h-10 w-10 sm:w-10"
      />
    );
  }

  if (user) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 focus:outline-none"
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || ""}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full ring-2
                ring-transparent hover:ring-[var(--ds-primary)]
                transition-all duration-200"
            />
          ) : (
            <div
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--ds-primary)]
              text-[var(--ds-primary-fg)] flex items-center justify-center
              text-lg font-semibold ring-2 ring-transparent
              hover:ring-[var(--ds-primary)]
              transition-all duration-200"
            >
              {(user.displayName || user.email || "U")[0].toUpperCase()}
            </div>
          )}
        </button>

        {showDropdown && (
          <div
            className="absolute right-0 mt-2 w-48 rounded-md shadow-lg
            bg-[var(--ds-bg)] border border-[var(--ds-border)]"
          >
            <div className="py-1">
              <div
                className="px-4 py-2 text-sm text-[var(--ds-fg)]
                border-b border-[var(--ds-border)]"
              >
                <p className="font-medium truncate">
                  {user.displayName || user.email}
                </p>
                {user.displayName && (
                  <p className="text-[var(--ds-fg-muted)] text-xs truncate">
                    {user.email}
                  </p>
                )}
              </div>

              <Link
                href="/my-annotations"
                onClick={() => setShowDropdown(false)}
                className="w-full text-left px-4 py-2 text-sm text-[var(--ds-fg)]
                  hover:bg-[var(--ds-surface-2)]
                  flex items-center gap-2"
              >
                <BookMarked className="w-4 h-4" />
                {t('myAnnotations')}
              </Link>

              <Link
                href="/vocabulary"
                onClick={() => setShowDropdown(false)}
                className="w-full text-left px-4 py-2 text-sm text-[var(--ds-fg)]
                  hover:bg-[var(--ds-surface-2)]
                  flex items-center gap-2"
              >
                <Tags className="w-4 h-4" />
                {t('vocabulary')}
              </Link>

              <Link
                href="/settings"
                onClick={() => setShowDropdown(false)}
                className="w-full text-left px-4 py-2 text-sm text-[var(--ds-fg)]
                  hover:bg-[var(--ds-surface-2)]
                  flex items-center gap-2"
              >
                <Key className="w-4 h-4" />
                {t('apiKeys')}
              </Link>

              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-sm text-red-600
                  dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30
                  flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                {t('logout')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setShowModal(true)} className={buttonClass("primary", "sm")}>
        {t('login')}
      </button>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70
          flex items-center justify-center z-50 p-4"
        >
          <div
            className="bg-[var(--ds-bg)] border border-[var(--ds-border)] p-6 rounded-lg w-full
            max-w-md relative"
          >
            <h2 className="text-xl font-bold mb-4 text-[var(--ds-fg)]">
              {isSignUp ? t('createAccount') : t('signIn')}
            </h2>

            {error && (
              <div
                className="bg-red-100 dark:bg-red-900/30 border
                border-red-400 dark:border-red-800 text-red-700
                dark:text-red-400 px-4 py-3 rounded mb-4"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block mb-2 text-[var(--ds-fg)]">
                  {t('email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 border rounded-md bg-[var(--ds-bg)]
                    border-[var(--ds-border)] text-[var(--ds-fg)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--ds-ring)]"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 text-[var(--ds-fg)]">
                  {t('password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 border rounded-md bg-[var(--ds-bg)]
                    border-[var(--ds-border)] text-[var(--ds-fg)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--ds-ring)]"
                  required
                />
              </div>
              <button type="submit" className={buttonClass("primary", "sm", "w-full")}>
                {isSignUp ? t('createAccount') : t('signIn')}
              </button>
            </form>

            <button
              onClick={signInWithGoogle}
              className={buttonClass("secondary", "sm", "w-full mt-4")}
            >
              <img
                src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png"
                alt="Google"
                className="w-6 h-6 mr-2"
              />
              {t('signInWithGoogle')}
            </button>

            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full mt-4 text-[var(--ds-primary)] hover:underline"
            >
              {isSignUp ? t('existingAccount') : t('newAccount')}
            </button>

            <button
              onClick={() => setShowModal(false)}
              className="absolute top-2 right-2 text-[var(--ds-fg-muted)]
                hover:text-[var(--ds-fg)]"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
