"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { IconLock } from "@tabler/icons-react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-light mb-4">
          <IconLock size={24} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text">Pulse</h1>
        <p className="text-sm text-text-secondary mt-1">Mending Minds Staff Portal</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@mendingmindstherapy.com"
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
        />
        {error && (
          <p className="text-sm text-error text-center">{error}</p>
        )}
        <Button type="submit" loading={loading} size="lg" className="w-full">
          Sign In
        </Button>
      </form>

      <p className="text-xs text-text-secondary text-center mt-6">
        Protected health information is encrypted and access is logged.
      </p>
    </div>
  );
}
