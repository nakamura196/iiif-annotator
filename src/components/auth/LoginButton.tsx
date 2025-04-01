"use client";

import { useState } from "react";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

interface LoginButtonProps {
  user: User | null;
  loading: boolean;
}

export function LoginButton({ user, loading }: LoginButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");

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
    return <div>Loading...</div>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        {user.photoURL && (
          <img
            src={user.photoURL}
            alt={user.displayName || ""}
            className="w-8 h-8 rounded-full"
          />
        )}
        <span>{user.displayName || user.email}</span>
        <button
          onClick={handleSignOut}
          className="bg-red-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-red-600 transition-colors duration-150"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600 transition-colors duration-150"
      >
        Login
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 relative">
            <h2 className="text-xl font-bold mb-4">
              {isSignUp ? "アカウント作成" : "ログイン"}
            </h2>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block mb-2">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block mb-2">パスワード</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600 transition-colors duration-150"
              >
                {isSignUp ? "アカウント作成" : "ログイン"}
              </button>
            </form>

            <button
              onClick={signInWithGoogle}
              className="w-full mt-4 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 flex items-center justify-center"
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
              className="w-full mt-4 text-blue-500 hover:text-blue-600"
            >
              {isSignUp ? "既存のアカウントでログイン" : "新規アカウント作成"}
            </button>

            <button
              onClick={() => setShowModal(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
