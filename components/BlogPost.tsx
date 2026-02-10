import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from './Navbar';
import { getBlogBySlug } from '../lib/blog';
import type { BlogPost as BlogPostType } from '../lib/blog';

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    getBlogBySlug(slug).then((data) => {
      setPost(data ?? null);
      setNotFound(!data);
      setLoading(false);
    });
  }, [slug]);

  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} | Veriflo`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', post.meta_description);
    return () => {
      document.title = 'Veriflo : AI Invoice Automation and Workflow Automation for Ecommerce Sellers';
    };
  }, [post]);

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

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </>
    );
  }

  if (notFound || !post) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-4 text-foreground">Post not found</h1>
            <Link to="/blog" className="text-primary hover:underline">Back to Blog</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <article>
            <h1 className="text-4xl font-bold mb-2 text-foreground">{post.title}</h1>
            <p className="text-sm text-muted-foreground mb-10">
              {formatDate(post.published_at)}
            </p>
            <div
              className="blog-prose text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </article>
          <p className="mt-12 pt-8 border-t border-muted-foreground/20">
            <Link to="/blog" className="text-primary hover:underline">← Back to Blog</Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default BlogPost;
