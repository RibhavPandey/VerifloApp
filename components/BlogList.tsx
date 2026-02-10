import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import { getBlogList } from '../lib/blog';
import type { BlogPostListItem } from '../lib/blog';

const BlogList: React.FC = () => {
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBlogList().then((data) => {
      setPosts(data);
      setLoading(false);
    });
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Blog</h1>
          <p className="text-muted-foreground mb-12">
            Guides on document AI, invoice extraction, and workflow automation.
          </p>

          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : posts.length === 0 ? (
            <p className="text-muted-foreground">No posts yet.</p>
          ) : (
            <ul className="space-y-10">
              {posts.map((post) => (
                <li key={post.slug} className="border-b border-muted-foreground/20 pb-10 last:border-0 last:pb-0">
                  <Link
                    to={`/blog/${post.slug}`}
                    className="group block"
                  >
                    <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                      {post.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-2">
                      {formatDate(post.published_at)}
                    </p>
                    <p className="text-muted-foreground">
                      {post.meta_description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default BlogList;
