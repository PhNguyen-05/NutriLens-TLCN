import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { resolveMediaUrl } from '../community/communityUtils'

const ARTICLE_CATEGORY_FALLBACKS = {
  vitamin: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
  'tiểu đường': 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=500&auto=format&fit=crop&q=80',
  'sức khỏe': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&auto=format&fit=crop&q=80',
  'sức khoẻ': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&auto=format&fit=crop&q=80',
  'dinh dưỡng': 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=500&auto=format&fit=crop&q=80',
  'mẹo ăn uống': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80',
  'vận động': 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=80',
  'tập luyện': 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=80',
}

const DEFAULT_ARTICLE_COVER = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=500&auto=format&fit=crop&q=80'

function getArticleFallbackImage(category = '') {
  const normalized = String(category).trim().toLowerCase()
  for (const [key, url] of Object.entries(ARTICLE_CATEGORY_FALLBACKS)) {
    if (normalized.includes(key)) return url
  }
  return DEFAULT_ARTICLE_COVER
}

function getArticleExcerpt(content, maxLength = 80) {
  if (!content) return ''
  const clean = String(content)
    .replace(/<[^>]+>/g, '')
    .replace(/[#*`_~>[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean.length > maxLength ? clean.slice(0, maxLength) + '...' : clean
}

function formatArticleCategory(article) {
  const cat = article?.category || article?.categoryTags?.[0] || 'Dinh dưỡng'
  return cat.charAt(0).toUpperCase() + cat.slice(1)
}

function formatArticleDate(dateStr) {
  if (!dateStr) return 'Gần đây'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 'Gần đây'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export default function DashboardArticleCard({ article }) {
  const navigate = useNavigate()
  const category = formatArticleCategory(article)
  const publishDate = formatArticleDate(article.publishedAt || article.createdAt)
  const resolvedUrl = resolveMediaUrl(article?.imageUrl)
  const fallbackUrl = getArticleFallbackImage(category)
  const [currentImg, setCurrentImg] = useState(resolvedUrl || fallbackUrl)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const nextUrl = resolveMediaUrl(article?.imageUrl) || getArticleFallbackImage(category)
    setCurrentImg(nextUrl)
    setImageError(false)
  }, [article?.imageUrl, category])

  const handleImageError = () => {
    if (currentImg !== fallbackUrl) {
      setCurrentImg(fallbackUrl)
    } else {
      setImageError(true)
    }
  }

  const excerpt = getArticleExcerpt(article.content, 75)

  const handleCardClick = (e) => {
    if (!e.target.closest('a') && !e.target.closest('button')) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      navigate(`/articles/${article._id}`)
    }
  }

  const handleLinkClick = (e) => {
    e.stopPropagation()
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  return (
    <article
      className="dashboard-article-card"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleCardClick(e)
      }}
    >
      <div className="article-card-cover-wrap" aria-label={article.title} onClick={handleCardClick}>
        {!imageError ? (
          <img
            src={currentImg}
            alt={article.title}
            className="article-card-img"
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <div className="article-card-fallback-cover">
            <i className="bi bi-journal-richtext" />
          </div>
        )}
        <span className="article-card-badge">{category}</span>
      </div>

      <div className="article-card-content">
        <div className="article-card-meta">
          <span><i className="bi bi-calendar3" /> {publishDate}</span>
          {Boolean(article.viewCount) && (
            <span><i className="bi bi-eye" /> {article.viewCount}</span>
          )}
        </div>

        <h3 className="article-card-title" title={article.title}>
          <Link to={`/articles/${article._id}`} onClick={handleLinkClick}>
            {article.title}
          </Link>
        </h3>

        {excerpt && (
          <p className="article-card-snippet" title={excerpt}>
            {excerpt}
          </p>
        )}

        <div className="article-card-action">
          <Link to={`/articles/${article._id}`} className="article-card-read-more" onClick={handleLinkClick}>
            Đọc tiếp <i className="bi bi-arrow-right" />
          </Link>
        </div>
      </div>
    </article>
  )
}
