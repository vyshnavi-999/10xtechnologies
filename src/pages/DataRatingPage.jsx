import React, { useEffect } from 'react';

// Serves the standalone rating study from public/data/index.html at the exact URL /data.
// The study page is not linked from anywhere on the site.
const DataRatingPage = () => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Story rating study';

    let robots = document.querySelector('meta[name="robots"]');
    const created = !robots;
    if (created) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    const previousContent = robots.content;
    robots.content = 'noindex, nofollow';

    return () => {
      document.title = previousTitle;
      if (created) robots.remove();
      else robots.content = previousContent;
    };
  }, []);

  return (
    <iframe
      src="/data/index.html"
      title="Story rating study"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0, background: '#fff' }}
    />
  );
};

export default DataRatingPage;
