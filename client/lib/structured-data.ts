/**
 * JSON-LD Structured Data generators for SEO
 * Used in server components (layout.tsx, page.tsx) via <script type="application/ld+json">
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://balencia.app';

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Balencia',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: 'AI-Powered Personal Health & Wellness Platform',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: `${SITE_URL}/help`,
    },
  };
}

export function webSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Balencia',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/blogs?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Balencia',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    description:
      'AI-driven fitness plans, smart nutrition tracking, mental wellness tools, and personalized coaching — all in one platform.',
    url: SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };
}

export function articleJsonLd(article: {
  title: string;
  description: string;
  url: string;
  image?: string;
  publishedTime?: string;
  modifiedTime?: string;
  authorName?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    url: article.url,
    ...(article.image && { image: article.image }),
    ...(article.publishedTime && { datePublished: article.publishedTime }),
    ...(article.modifiedTime && { dateModified: article.modifiedTime }),
    author: {
      '@type': 'Person',
      name: article.authorName || 'Balencia Team',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Balencia',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function faqJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
