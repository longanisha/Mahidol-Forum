import { useState } from 'react'

type ForumFiltersProps = {
  searchQuery: string
  onSearchChange: (value: string) => void
  tags: string[]
  selectedTag: string | null
  onSelectTag: (tag: string | null) => void
  resultCount: number
  hotTags?: Set<string>
}

export function ForumFilters({
  searchQuery,
  onSearchChange,
  tags,
  selectedTag,
  onSelectTag,
  resultCount,
  hotTags = new Set(),
}: ForumFiltersProps) {
  const [isTagsExpanded, setIsTagsExpanded] = useState(false)
  
  // 估算第一行能显示多少个标签（根据常见屏幕宽度，大约8-10个）
  const TAGS_PER_ROW = 8
  const visibleTags = isTagsExpanded ? tags : tags.slice(0, TAGS_PER_ROW)
  const hasMoreTags = tags.length > TAGS_PER_ROW
  return (
    <div className="space-y-4">
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" aria-hidden="true">
          🔍
        </span>
        <input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by keywords…"
          aria-label="Search discussions"
          className="w-full pl-11 pr-24 py-3 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-sm font-medium text-warm hover:bg-warm/10 rounded-lg transition"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2" role="listbox" aria-label="Filter by tag">
          <button
            type="button"
            onClick={() => onSelectTag(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
              selectedTag === null
                ? 'bg-accent text-white shadow-md'
                : 'bg-white text-primary/70 border border-primary/15 hover:border-accent/50 hover:text-accent'
            }`}
          >
            All
          </button>
          {visibleTags.map((tag) => {
            const isHot = hotTags.has(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectTag(tag === selectedTag ? null : tag)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-1.5 ${
                  selectedTag === tag
                    ? 'bg-accent text-white shadow-md'
                    : 'bg-white text-primary/70 border border-primary/15 hover:border-accent/50 hover:text-accent'
                }`}
              >
                {isHot && (
                  <i className="fa-solid fa-fire text-warm" title="Hot tag"></i>
                )}
                {tag}
              </button>
            )
          })}
        </div>
        {hasMoreTags && (
          <button
            type="button"
            onClick={() => setIsTagsExpanded(!isTagsExpanded)}
            className="text-sm text-accent hover:text-accent/80 font-medium flex items-center gap-1 transition"
          >
            {isTagsExpanded ? (
              <>
                <span>Collapse</span>
                <span>▲</span>
              </>
            ) : (
              <>
                <span>More Tags ({tags.length - TAGS_PER_ROW})</span>
                <span>▼</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-primary/70">
          {resultCount} {resultCount === 1 ? 'topic' : 'topics'}
        </span>
        {selectedTag ? (
          <span className="px-3 py-1 rounded-full bg-accent/10 text-accent font-medium">
            Filtered by {selectedTag}
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full bg-primary/5 text-primary/60 font-medium">
            All community tags
          </span>
        )}
      </div>
    </div>
  )
}
