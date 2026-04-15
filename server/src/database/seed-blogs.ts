/**
 * @file Seed Blog Posts
 * @description Creates 3 seed blog posts about Balencia features
 */

import { query, closePool } from './pg.js';

/**
 * Calculate reading time in minutes based on content
 */
function calculateReadingTime(content: string): number {
  // Average reading speed: 200-250 words per minute
  // We'll use 225 as a middle ground
  const wordsPerMinute = 225;
  
  // Remove HTML tags for accurate word count
  const textContent = content.replace(/<[^>]*>/g, ' ').trim();
  const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
  
  // Calculate minutes (minimum 1 minute)
  const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  
  return minutes;
}

interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface BlogSeed {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  category: string;
  tags: string[];
}

const BLOG_POSTS: BlogSeed[] = [
  {
    title: "Introducing Balencia: The Future of Personalized Health Management",
    slug: "introducing-balencia-future-personalized-health-management",
    excerpt: "Discover how Balencia is revolutionizing personal health and wellness through AI-powered insights, comprehensive health tracking, and intelligent coaching that adapts to your unique needs.",
    content: `<h2>Welcome to Balencia: Your Complete Health Transformation Platform</h2>
<p>In an era where health data is fragmented across countless apps and devices, Balencia emerges as the unified platform that brings everything together. We're not just another fitness app—we're your intelligent health companion, powered by cutting-edge AI and designed to understand you like never before.</p>

<h3>The Balencia Vision</h3>
<p>Balencia was born from a simple yet powerful idea: <strong>health should be personal, intelligent, and accessible.</strong> We've built a comprehensive platform that combines:</p>
<ul>
  <li><strong>AI-Powered Intelligence:</strong> Advanced machine learning that learns from your patterns, preferences, and progress</li>
  <li><strong>Holistic Health Tracking:</strong> From fitness and nutrition to sleep, recovery, and mental wellbeing</li>
  <li><strong>Seamless Integration:</strong> Connect all your health devices and apps in one unified dashboard</li>
  <li><strong>Personalized Coaching:</strong> AI coaches that adapt to your style, goals, and lifestyle</li>
  <li><strong>Data-Driven Insights:</strong> Real-time analytics that help you make informed health decisions</li>
</ul>

<h3>Why Balencia is Different</h3>
<p>Unlike traditional health apps that offer generic advice, Balencia creates a truly personalized experience:</p>

<h4>1. Intelligent Assessment</h4>
<p>Our AI-powered assessment system goes beyond simple questionnaires. Through conversational AI and deep learning, we understand not just what you want to achieve, but why, and how to help you get there.</p>

<h4>2. Unified Health Ecosystem</h4>
<p>Connect WHOOP, Fitbit, Garmin, Oura, Strava, Apple Health, and Google Fit—all in one place. Balencia intelligently prioritizes data sources and gives you a complete picture of your health.</p>

<h4>3. Adaptive AI Coaching</h4>
<p>Choose from multiple coaching styles (Supportive, Direct, Analytical, Motivational) and intensity levels. Your AI coach learns your preferences and adapts recommendations in real-time.</p>

<h4>4. Comprehensive Health Pillars</h4>
<p>Balencia addresses five core health pillars:</p>
<ul>
  <li><strong>Fitness Optimization:</strong> Personalized workout plans that adapt to your progress</li>
  <li><strong>Nutrition Intelligence:</strong> AI-powered meal planning and dietary insights</li>
  <li><strong>Wellbeing Coaching:</strong> Mental health, stress management, and emotional wellness</li>
  <li><strong>Goal Achievement:</strong> SMART goal framework with intelligent tracking</li>
  <li><strong>Real-Time Insights:</strong> Instant analytics and proactive recommendations</li>
</ul>

<h3>The Technology Behind Balencia</h3>
<p>Built on modern, scalable architecture:</p>
<ul>
  <li><strong>Multi-Provider AI:</strong> Leveraging OpenAI, DeepSeek, and Google Gemini with intelligent fallback</li>
  <li><strong>Advanced Analytics:</strong> Real-time processing of health metrics from multiple sources</li>
  <li><strong>Secure Infrastructure:</strong> Enterprise-grade security and privacy protection</li>
  <li><strong>Scalable Platform:</strong> Designed to grow with your health journey</li>
</ul>

<h3>Your Health Journey Starts Here</h3>
<p>Whether you're a fitness enthusiast, someone starting their wellness journey, or looking to optimize your health, Balencia adapts to your needs. Our platform learns from your data, understands your goals, and provides personalized guidance every step of the way.</p>

<h3>Join the Health Revolution</h3>
<p>Balencia is more than an app—it's a movement toward personalized, intelligent health management. Experience the future of wellness where AI understands you, data guides you, and technology empowers you to achieve your best health.</p>

<p><strong>Ready to transform your health?</strong> Start your journey with Balencia today and discover what personalized health management truly means.</p>`,
    meta_title: "Introducing Balencia: The Future of Personalized Health Management",
    meta_description: "Discover Balencia, the comprehensive AI-powered health platform that unifies fitness, nutrition, wellness, and coaching into one intelligent system designed for your unique needs.",
    meta_keywords: "Balencia, personalized health, AI health platform, health management, wellness technology, fitness AI, health tracking",
    category: "Platform",
    tags: ["Balencia", "Health Platform", "AI", "Wellness", "Technology"],
  },
  {
    title: "How Balencia Transforms Personal Health Through AI and Data Intelligence",
    slug: "how-balencia-transforms-personal-health-ai-data-intelligence",
    excerpt: "Explore how Balencia leverages artificial intelligence, wearable device integration, and comprehensive data analytics to deliver personalized health insights and actionable recommendations.",
    content: `<h2>The Balencia Advantage: AI-Powered Health Transformation</h2>
<p>In a world overflowing with health apps and fitness trackers, Balencia stands apart by combining artificial intelligence, comprehensive data integration, and personalized coaching into one seamless platform. Here's how we're transforming personal health management.</p>

<h3>The Power of Unified Health Data</h3>
<p>Most people have health data scattered across multiple platforms—a fitness tracker here, a nutrition app there, sleep data somewhere else. Balencia solves this fragmentation by creating a unified health ecosystem.</p>

<h4>Comprehensive Device Integration</h4>
<p>Connect all your health devices and platforms:</p>
<ul>
  <li><strong>Fitness Trackers:</strong> WHOOP, Fitbit, Garmin, Oura Ring</li>
  <li><strong>Activity Platforms:</strong> Strava, Apple Health, Google Fit</li>
  <li><strong>Smart Devices:</strong> Smart scales, blood pressure monitors, and more</li>
</ul>
<p>Balencia intelligently syncs data from all sources, eliminates duplicates, and creates a single source of truth for your health metrics.</p>

<h3>AI That Understands You</h3>
<p>Our multi-provider AI system (OpenAI, DeepSeek, Gemini) doesn't just process data—it understands context, patterns, and your unique health journey.</p>

<h4>Intelligent Pattern Recognition</h4>
<ul>
  <li><strong>Recovery Analysis:</strong> Correlates sleep quality with workout performance</li>
  <li><strong>Trend Detection:</strong> Identifies patterns before they become problems</li>
  <li><strong>Predictive Insights:</strong> Anticipates needs and suggests proactive interventions</li>
  <li><strong>Adaptive Recommendations:</strong> Adjusts suggestions based on your progress and feedback</li>
</ul>

<h4>Conversational AI Assessment</h4>
<p>Unlike static questionnaires, Balencia's Deep Assessment uses conversational AI to:</p>
<ul>
  <li>Ask intelligent follow-up questions based on your responses</li>
  <li>Explore motivations, barriers, and lifestyle factors</li>
  <li>Build a comprehensive understanding of your health context</li>
  <li>Generate personalized recommendations in real-time</li>
</ul>

<h3>Personalized Coaching at Scale</h3>
<p>Balencia's AI coaching system adapts to your personality, preferences, and goals:</p>

<h4>Four Distinct Coaching Styles</h4>
<ul>
  <li><strong>Supportive:</strong> Warm, encouraging, empathetic approach</li>
  <li><strong>Direct:</strong> Straightforward, no-nonsense, results-focused</li>
  <li><strong>Analytical:</strong> Data-driven, detail-oriented, evidence-based</li>
  <li><strong>Motivational:</strong> Energetic, inspiring, goal-oriented</li>
</ul>

<h4>Intelligent Intensity Levels</h4>
<p>Choose from Gentle, Moderate, or Intensive coaching based on your needs and preferences. The system learns what works best for you and adjusts automatically.</p>

<h3>Real-Time Health Intelligence</h3>
<p>Balencia processes your health data in real-time to provide:</p>
<ul>
  <li><strong>Immediate Insights:</strong> Understand what your data means right now</li>
  <li><strong>Proactive Alerts:</strong> Get notified about important patterns or concerns</li>
  <li><strong>Actionable Recommendations:</strong> Clear, specific steps you can take</li>
  <li><strong>Progress Tracking:</strong> Visualize your journey with comprehensive analytics</li>
</ul>

<h3>Safety and Health Guardrails</h3>
<p>Balencia prioritizes your safety with built-in health guardrails:</p>
<ul>
  <li>Detects potential overexertion from wearable data</li>
  <li>Recommends rest when recovery scores are low</li>
  <li>Suggests medical consultation for concerning patterns</li>
  <li>Respects your limitations and previous injuries</li>
  <li>Provides evidence-based recommendations only</li>
</ul>

<h3>The Balencia Difference</h3>
<p>What sets Balencia apart:</p>
<ul>
  <li><strong>Holistic Approach:</strong> Addresses fitness, nutrition, recovery, and mental wellbeing</li>
  <li><strong>Continuous Learning:</strong> AI that gets smarter with your data</li>
  <li><strong>Privacy First:</strong> Your data is encrypted, secure, and never shared</li>
  <li><strong>Scalable Platform:</strong> Grows with you from beginner to advanced</li>
  <li><strong>Evidence-Based:</strong> Recommendations backed by health science</li>
</ul>

<h3>Transform Your Health Today</h3>
<p>Balencia isn't just tracking your health—it's actively helping you improve it. Through intelligent analysis, personalized coaching, and comprehensive data integration, we're making advanced health management accessible to everyone.</p>

<p>Experience the future of personal health. Join Balencia and discover how AI and data intelligence can transform your wellness journey.</p>`,
    meta_title: "How Balencia Transforms Personal Health Through AI and Data Intelligence",
    meta_description: "Learn how Balencia leverages AI, wearable integration, and data analytics to deliver personalized health insights and transform your wellness journey.",
    meta_keywords: "AI health, health transformation, personalized health, health analytics, wellness AI, health intelligence",
    category: "Technology",
    tags: ["AI", "Health Intelligence", "Data Analytics", "Personalization", "Technology"],
  },
  {
    title: "The Future of Health: How Balencia is Revolutionizing Wellness Technology",
    slug: "future-of-health-balencia-revolutionizing-wellness-technology",
    excerpt: "Discover how Balencia is pioneering the next generation of health technology, combining AI, wearable integration, and personalized coaching to create the most advanced wellness platform available.",
    content: `<h2>The Next Generation of Health Technology</h2>
<p>The health and wellness industry is at an inflection point. Traditional apps offer generic advice, wearable devices provide raw data without context, and coaching services are expensive and inaccessible. Balencia is changing all of that by creating the first truly intelligent, personalized health platform.</p>

<h3>Why Current Solutions Fall Short</h3>
<p>Most health apps today suffer from fundamental limitations:</p>
<ul>
  <li><strong>One-Size-Fits-All Approach:</strong> Generic recommendations that don't account for individual differences</li>
  <li><strong>Data Silos:</strong> Information trapped in separate apps and devices</li>
  <li><strong>Lack of Intelligence:</strong> Simple tracking without meaningful insights</li>
  <li><strong>No Personalization:</strong> Same experience for everyone regardless of goals or preferences</li>
  <li><strong>Reactive, Not Proactive:</strong> Telling you what happened, not what to do next</li>
</ul>

<h3>The Balencia Revolution</h3>
<p>Balencia represents a paradigm shift in health technology. We've built a platform that:</p>

<h4>1. Unifies Your Health Ecosystem</h4>
<p>Instead of juggling multiple apps, Balencia becomes your single health command center. Connect WHOOP for recovery, Fitbit for activity, Strava for workouts, and more—all synchronized and analyzed together.</p>

<h4>2. Learns and Adapts</h4>
<p>Our AI doesn't just process data—it learns your patterns, understands your preferences, and adapts recommendations in real-time. The more you use Balencia, the smarter it gets.</p>

<h4>3. Provides True Personalization</h4>
<p>From assessment to coaching style to plan generation, every aspect of Balencia is tailored to you. No two users have the same experience because no two people are the same.</p>

<h4>4. Offers Proactive Intelligence</h4>
<p>Balencia doesn't wait for you to ask questions. It analyzes your data, identifies patterns, and proactively suggests actions before problems arise.</p>

<h3>Advanced Features That Set Us Apart</h3>

<h4>Multi-Provider AI Architecture</h4>
<p>Balencia uses a sophisticated multi-provider AI system with automatic fallback:</p>
<ul>
  <li>Primary: OpenAI for complex reasoning and analysis</li>
  <li>Secondary: DeepSeek for cost-effective processing</li>
  <li>Tertiary: Google Gemini for specialized tasks</li>
</ul>
<p>This ensures reliability, cost efficiency, and optimal performance for every request.</p>

<h4>Intelligent Data Fusion</h4>
<p>When you have multiple devices tracking the same metric, Balencia's "Golden Source" system intelligently prioritizes data sources based on accuracy, reliability, and your preferences.</p>

<h4>Conversational Health Assessment</h4>
<p>Our Deep Assessment uses conversational AI to conduct natural, adaptive health evaluations. It's like talking to a health expert who remembers everything and asks the right follow-up questions.</p>

<h4>Adaptive Plan Generation</h4>
<p>Balencia creates personalized activity plans that:</p>
<ul>
  <li>Adapt to your schedule and availability</li>
  <li>Adjust intensity based on recovery data</li>
  <li>Modify recommendations based on progress</li>
  <li>Provide alternatives when life gets in the way</li>
</ul>

<h3>The Technology Stack</h3>
<p>Built on enterprise-grade infrastructure:</p>
<ul>
  <li><strong>Next.js & TypeScript:</strong> Modern, type-safe frontend</li>
  <li><strong>Node.js & Express:</strong> Scalable backend architecture</li>
  <li><strong>PostgreSQL:</strong> Robust data storage with advanced indexing</li>
  <li><strong>Cloudflare R2:</strong> Fast, global content delivery</li>
  <li><strong>Multi-Provider AI:</strong> Redundant, intelligent processing</li>
</ul>

<h3>Privacy and Security First</h3>
<p>Your health data is among the most sensitive information you have. Balencia treats it accordingly:</p>
<ul>
  <li>End-to-end encryption for all data transfers</li>
  <li>Read-only access to connected devices</li>
  <li>No data sharing with third parties</li>
  <li>Full user control over data and integrations</li>
  <li>Compliance with health data regulations</li>
</ul>

<h3>What's Next for Health Technology</h3>
<p>Balencia is just the beginning. We're continuously innovating with:</p>
<ul>
  <li><strong>Voice Coaching:</strong> Hands-free, real-time workout guidance</li>
  <li><strong>Advanced Analytics:</strong> Predictive health modeling</li>
  <li><strong>Community Features:</strong> Connect with others on similar journeys</li>
  <li><strong>Healthcare Integration:</strong> Bridge to medical professionals</li>
  <li><strong>Expanded Device Support:</strong> More integrations, more insights</li>
</ul>

<h3>Join the Health Revolution</h3>
<p>The future of personal health management is here. Balencia combines the best of AI, data science, and user experience design to create something truly revolutionary.</p>

<p>Whether you're optimizing peak performance, starting a wellness journey, or managing chronic conditions, Balencia adapts to your needs and grows with you.</p>

<p><strong>Experience the future of health technology.</strong> Join thousands of users who have transformed their wellness journey with Balencia.</p>

<p>Your health deserves intelligence, personalization, and innovation. That's exactly what Balencia delivers.</p>`,
    meta_title: "The Future of Health: How Balencia is Revolutionizing Wellness Technology",
    meta_description: "Explore how Balencia is pioneering the next generation of health technology with AI, data intelligence, and personalized wellness solutions.",
    meta_keywords: "health technology, wellness innovation, AI health platform, future of health, health revolution, wellness technology",
    category: "Innovation",
    tags: ["Technology", "Innovation", "Health Revolution", "AI", "Future of Health"],
  },
];

async function seedBlogs() {
  console.log('📝 Starting blog posts seed...\n');

  try {
    // Get an admin user or first user to use as author
    const adminUser = await query<UserRow>(
      `SELECT u.id, u.email, u.first_name, u.last_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.slug = 'admin'
       ORDER BY u.created_at ASC
       LIMIT 1`
    );

    let authorId: string;
    let authorName: string;

    if (adminUser.rows.length > 0) {
      authorId = adminUser.rows[0].id;
      authorName = `${adminUser.rows[0].first_name} ${adminUser.rows[0].last_name}`;
      console.log(`✅ Using admin user as author: ${authorName} (${adminUser.rows[0].email})`);
    } else {
      // Fallback to first user if no admin exists
      const firstUser = await query<UserRow>(
        `SELECT id, email, first_name, last_name 
         FROM users 
         ORDER BY created_at ASC 
         LIMIT 1`
      );

      if (firstUser.rows.length === 0) {
        throw new Error('No users found in database. Please create a user first.');
      }

      authorId = firstUser.rows[0].id;
      authorName = `${firstUser.rows[0].first_name} ${firstUser.rows[0].last_name}`;
      console.log(`⚠️  No admin user found. Using first user as author: ${authorName} (${firstUser.rows[0].email})`);
    }

    // Check for existing blogs
    const existingBlogs = await query<{ slug: string }>(
      'SELECT slug FROM blogs WHERE slug = ANY($1)',
      [BLOG_POSTS.map(b => b.slug)]
    );

    const existingSlugs = new Set(existingBlogs.rows.map(b => b.slug));
    const blogsToInsert = BLOG_POSTS.filter(b => !existingSlugs.has(b.slug));
    const blogsToUpdate = BLOG_POSTS.filter(b => existingSlugs.has(b.slug));

    // Update existing blogs
    if (blogsToUpdate.length > 0) {
      console.log(`\n🔄 Updating ${blogsToUpdate.length} existing blog post(s)...`);
      for (const post of blogsToUpdate) {
        const readingTime = calculateReadingTime(post.content);
        await query(
          `UPDATE blogs SET
            title = $1,
            excerpt = $2,
            content = $3,
            meta_title = $4,
            meta_description = $5,
            meta_keywords = $6,
            reading_time = $7,
            status = 'published',
            published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
          WHERE slug = $8`,
          [
            post.title,
            post.excerpt,
            post.content,
            post.meta_title,
            post.meta_description,
            post.meta_keywords,
            readingTime,
            post.slug,
          ]
        );
        console.log(`✅ Updated: "${post.title}"`);
      }
    }

    if (blogsToInsert.length === 0 && blogsToUpdate.length > 0) {
      console.log('\n🎉 Blog posts update completed successfully!');
      return;
    }

    if (blogsToInsert.length === 0) {
      console.log('✅ All blog posts already exist in database');
      return;
    }

    console.log(`\n📄 Inserting ${blogsToInsert.length} blog post(s)...\n`);

    // Insert each blog post
    for (const blog of blogsToInsert) {
      const readingTime = calculateReadingTime(blog.content);
      const publishedAt = new Date();

      await query(
        `INSERT INTO blogs (
          title, slug, excerpt, content, 
          author_id, status, published_at,
          meta_title, meta_description, meta_keywords,
          reading_time, views
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          blog.title,
          blog.slug,
          blog.excerpt,
          blog.content,
          authorId,
          'published',
          publishedAt,
          blog.meta_title,
          blog.meta_description,
          blog.meta_keywords,
          readingTime,
          0, // Initial views
        ]
      );

      console.log(`✅ Created: "${blog.title}"`);
      console.log(`   Slug: ${blog.slug}`);
      console.log(`   Reading time: ${readingTime} minutes`);
      console.log(`   Category: ${blog.category}`);
      console.log(`   Tags: ${blog.tags.join(', ')}\n`);
    }

    console.log('🎉 Blog posts seed completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   Total blog posts: ${BLOG_POSTS.length}`);
    console.log(`   Newly created: ${blogsToInsert.length}`);
    console.log(`   Already existed: ${existingSlugs.size}`);

  } catch (error) {
    console.error('❌ Blog seed failed:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Run seed
seedBlogs().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

