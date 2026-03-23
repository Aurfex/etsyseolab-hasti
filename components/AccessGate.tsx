import React from 'react';

const AccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(true);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let isMounted = true;

    const checkAccess = async () => {
      try {
        const response = await fetch('/api/auth/login?gate=1', { credentials: 'include' });
        const data = await response.json().catch(() => ({}));
        if (!isMounted) return;
        setIsUnlocked(Boolean(data.unlocked));
      } catch {
        if (!isMounted) return;
        setIsUnlocked(false);
      } finally {
        if (isMounted) setIsChecking(false);
      }
    };

    checkAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/auth/login?gate=1', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'رمز اشتباهه. دوباره امتحان کن.');
      }

      setIsUnlocked(true);
    } catch (unlockError) {
      const message = unlockError instanceof Error ? unlockError.message : 'رمز اشتباهه. دوباره امتحان کن.';
      setError(message);
    }
  };

  const handleClear = () => {
    fetch('/api/auth/login?gate=1', {
      method: 'DELETE',
      credentials: 'include',
    }).finally(() => {
      setIsUnlocked(false);
      setCode('');
      setError('');
    });
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-white/15 border-t-orange-400" />
          <p className="mt-4 text-sm text-white/70">Checking access...</p>
        </div>
      </div>
    );
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937_0%,_#0f172a_45%,_#020617_100%)] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/30 p-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-orange-300/90">Private Access</p>
          <h1 className="mt-3 text-3xl font-black leading-tight">Etsyseolab-Hasti</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">
            این نسخه فقط با رمز وارد می‌شود. اگر رمز را داشته باشی، تا وقتی همین سشن باز است داخل می‌مانی.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-white/80">Access Code</span>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30"
              placeholder="رمز را وارد کن"
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-400 active:scale-[0.99]"
          >
            Enter the private build
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white/75 transition hover:bg-white/10"
          >
            Clear this session
          </button>
        </form>

        <p className="mt-6 text-xs leading-5 text-white/45">
          رمز از سرور چک می‌شود و داخل bundle لو نمی‌رود.
        </p>
      </div>
    </div>
  );
};

export default AccessGate;
