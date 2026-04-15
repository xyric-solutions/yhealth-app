import type { Metadata } from 'next';
import BlogDetailPageContent from './BlogDetailPageContent';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://balencia.app';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/blogs/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return { title: 'Blog Post - Balencia' };
    }
    const data = await res.json();
    const blog = data?.data;
    if (!blog) {
      return { title: 'Blog Post - Balencia' };
    }

    const title = blog.title;
    const description = blog.excerpt || blog.title;
    const image = blog.featured_image || DEFAULT_OG_IMAGE;
    const authorName = `${blog.author_first_name || ''} ${blog.author_last_name || ''}`.trim() || 'Balencia Team';

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        url: `${SITE_URL}/blogs/${slug}`,
        images: [{ url: image, width: 1200, height: 630, alt: title }],
        publishedTime: blog.published_at || undefined,
        authors: [authorName],
        siteName: 'Balencia',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
      alternates: {
        canonical: `${SITE_URL}/blogs/${slug}`,
      },
    };
  } catch {
    return { title: 'Blog Post - Balencia' };
  }
}

export default function BlogDetailPage() {
  return <BlogDetailPageContent />;
}
