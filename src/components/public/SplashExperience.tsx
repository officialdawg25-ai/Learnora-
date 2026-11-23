import { useEffect } from 'react';

type Props = { loading?: boolean; onComplete?: () => void };

export default function SplashExperience({ loading = false, onComplete }: Props) {
  useEffect(() => {
    if (loading || !onComplete) return;
    const timer = window.setTimeout(onComplete, 3600);
    return () => window.clearTimeout(timer);
  }, [loading, onComplete]);

  if (loading) return <main className="splash-loading" role="status" aria-label="Loading Learnora"><div className="splash-loading-inner"><div className="splash-loading-mark"><img src="/brand/learnora-mark.svg" alt="" /></div><p className="splash-loading-slogan">The Future Of Learning</p><span className="splash-loading-track" /></div></main>;

  const skip = () => onComplete?.();
  return (
    <main
      className="splash-screen"
      aria-label="Learnora"
      role="button"
      tabIndex={0}
      onClick={skip}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          skip();
        }
      }}
    >
      <div className="splash-mark-wrap" aria-hidden="true">
        <img className="splash-logo-trace" src="/brand/learnora-mark.svg" alt="Learnora" />
      </div>
      <p className="splash-slogan">The Future Of Learning</p>
    </main>
  );
}
