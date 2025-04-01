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
import { LogOut } from "lucide-react";

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
    } catch (error) {
      console.error("Error signing in with Google", error);
      setError("Googleログインに失敗しました");
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
      console.error("Error with email auth:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("エラーが発生しました");
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  if (loading) {
    return (
      <div
        className="animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 
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
                ring-transparent hover:ring-blue-500 dark:hover:ring-blue-400 
                transition-all duration-200"
            />
          ) : (
            <div
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500 
              dark:bg-blue-600 text-white flex items-center justify-center 
              text-lg font-semibold ring-2 ring-transparent 
              hover:ring-blue-500 dark:hover:ring-blue-400 
              transition-all duration-200"
            >
              {(user.displayName || user.email || "U")[0].toUpperCase()}
            </div>
          )}
        </button>

        {showDropdown && (
          <div
            className="absolute right-0 mt-2 w-48 rounded-md shadow-lg 
            bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5"
          >
            <div className="py-1">
              <div
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 
                border-b border-gray-200 dark:border-gray-700"
              >
                <p className="font-medium truncate">
                  {user.displayName || user.email}
                </p>
                {user.displayName && (
                  <p className="text-gray-500 dark:text-gray-400 text-xs truncate">
                    {user.email}
                  </p>
                )}
              </div>

              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-sm text-red-600 
                  dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 
                  flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="bg-blue-500 dark:bg-blue-600 text-white px-3 py-2 sm:px-4 
          rounded-md text-sm sm:text-base hover:bg-blue-600 
          dark:hover:bg-blue-700 transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-blue-500 
          dark:focus:ring-blue-600 focus:ring-offset-2"
      >
        Login
      </button>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 
          flex items-center justify-center z-50 p-4"
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full 
            max-w-md relative"
          >
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              {isSignUp ? "アカウント作成" : "ログイン"}
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
                <label className="block mb-2 text-gray-700 dark:text-gray-200">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 border rounded-md bg-white 
                    dark:bg-gray-700 border-gray-300 dark:border-gray-600
                    text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 text-gray-700 dark:text-gray-200">
                  パスワード
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 border rounded-md bg-white 
                    dark:bg-gray-700 border-gray-300 dark:border-gray-600
                    text-gray-900 dark:text-white"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-500 dark:bg-blue-600 text-white 
                  px-4 py-2 rounded-md hover:bg-blue-600 
                  dark:hover:bg-blue-700 transition-colors duration-150"
              >
                {isSignUp ? "アカウント作成" : "ログイン"}
              </button>
            </form>

            <button
              onClick={signInWithGoogle}
              className="w-full mt-4 bg-white dark:bg-gray-700 border 
                border-gray-300 dark:border-gray-600 text-gray-700 
                dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-50 
                dark:hover:bg-gray-600 flex items-center justify-center"
            >
              <img
                src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png"
                alt="Google"
                className="w-6 h-6 mr-2"
              />
              Googleでログイン
            </button>

            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full mt-4 text-blue-500 dark:text-blue-400 
                hover:text-blue-600 dark:hover:text-blue-500"
            >
              {isSignUp ? "既存のアカウントでログイン" : "新規アカウント作成"}
            </button>

            <button
              onClick={() => setShowModal(false)}
              className="absolute top-2 right-2 text-gray-500 dark:text-gray-400 
                hover:text-gray-700 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
