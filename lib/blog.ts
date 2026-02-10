import { supabase } from './supabase';

export interface BlogPostListItem {
  slug: string;
  title: string;
  meta_description: string;
  published_at: string;
}

export interface BlogPost extends BlogPostListItem {
  id: string;
  content: string;
  created_at: string;
}

export async function getBlogList(): Promise<BlogPostListItem[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug, title, meta_description, published_at')
    .order('published_at', { ascending: false });
  if (error) {
    console.error('getBlogList error:', error);
    return [];
  }
  return data ?? [];
}

export async function getBlogBySlug(slug: string): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return data as BlogPost;
}
