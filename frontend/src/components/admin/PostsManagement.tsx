import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'

function getAdminCredentials() {
    const adminId = localStorage.getItem('admin_id')
    const adminEmail = localStorage.getItem('admin_email')
    return { adminId, adminEmail }
}

async function fetchPosts(
    page: number = 1,
    pageSize: number = 10,
    category?: string,
    status?: string,
    search?: string
): Promise<any> {
    const { adminId, adminEmail } = getAdminCredentials()
    let url = `/admin/posts?page=${page}&page_size=${pageSize}`
    if (category) url += `&category=${encodeURIComponent(category)}`
    if (status) url += `&status_filter=${status}`
    if (search) url += `&search=${encodeURIComponent(search)}`

    return apiFetch(url, { adminId, adminEmail })
}

export function PostsManagement() {
    const queryClient = useQueryClient()
    const [page, setPage] = useState(1)
    const [pageSize] = useState(10)
    const [category, setCategory] = useState<string>('')
    const [status, setStatus] = useState<string>('')
    const [search, setSearch] = useState('')

    const { data: postsData, isLoading } = useQuery({
        queryKey: ['admin', 'posts', page, category, status, search],
        queryFn: () => fetchPosts(page, pageSize, category, status, search),
    })

    const posts = postsData?.items || []
    const totalPosts = postsData?.total || 0
    const totalPages = postsData?.total_pages || 0

    const { mutate: updatePost } = useMutation({
        mutationFn: async (data: {
            id: string
            title?: string
            category?: string
            tags?: string[]
            is_closed?: boolean
            is_pinned?: boolean
        }) => {
            const { adminId, adminEmail } = getAdminCredentials()
            const { id, ...updates } = data
            return apiFetch(`/admin/posts/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(updates),
                adminId,
                adminEmail,
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] })
            alert('Post updated successfully!')
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : 'Failed to update post'
            alert(message)
        },
    })

    const { mutate: deletePost } = useMutation({
        mutationFn: async (postId: string) => {
            const { adminId, adminEmail } = getAdminCredentials()
            return apiFetch(`/admin/posts/${postId}`, {
                method: 'DELETE',
                adminId,
                adminEmail,
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] })
            alert('Post deleted successfully!')
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : 'Failed to delete post'
            alert(message)
        },
    })

    return (
        <div className="bg-white rounded-2xl border border-primary/10 shadow-sm">
            <div className="p-6 border-b border-primary/10">
                <h2 className="text-xl font-bold text-primary">Posts Management</h2>
                <p className="text-sm text-primary/70 mt-1">
                    Manage all forum posts and flea market listings
                </p>
            </div>

            <div className="p-6">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-2">Search</label>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value)
                                setPage(1)
                            }}
                            placeholder="Search by title..."
                            className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-primary mb-2">Category</label>
                        <select
                            value={category}
                            onChange={(e) => {
                                setCategory(e.target.value)
                                setPage(1)
                            }}
                            className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                        >
                            <option value="">All Categories</option>
                            <option value="General">General</option>
                            <option value="Flea Market">Flea Market</option>
                            <option value="Academics">Academics</option>
                            <option value="Research">Research</option>
                            <option value="Student Life">Student Life</option>
                            <option value="Events">Events</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-primary mb-2">Status</label>
                        <select
                            value={status}
                            onChange={(e) => {
                                setStatus(e.target.value)
                                setPage(1)
                            }}
                            className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                        >
                            <option value="">All Status</option>
                            <option value="active">Active</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                </div>

                {/* Posts Table */}
                {isLoading ? (
                    <div className="p-8 text-center text-primary/60">Loading posts…</div>
                ) : posts.length === 0 ? (
                    <div className="p-8 text-center text-primary/60">No posts found</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Title
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Category
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Author
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Views
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {posts.map((post: any) => (
                                        <tr key={post.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                                                    {post.title}
                                                </div>
                                                {post.tags && post.tags.length > 0 && (
                                                    <div className="flex gap-1 mt-1 flex-wrap">
                                                        {post.tags.slice(0, 3).map((tag: string) => (
                                                            <span
                                                                key={tag}
                                                                className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                        {post.tags.length > 3 && (
                                                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                                                +{post.tags.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-700">
                                                    {post.category || 'General'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {post.author?.username || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {post.view_count || 0}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    {post.is_closed ? (
                                                        <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-700">
                                                            Closed
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-700">
                                                            Active
                                                        </span>
                                                    )}
                                                    {post.is_pinned && (
                                                        <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-700">
                                                            📌 Pinned
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex flex-col gap-2">
                                                    <button
                                                        onClick={() => {
                                                            updatePost({
                                                                id: post.id,
                                                                is_closed: !post.is_closed,
                                                            })
                                                        }}
                                                        className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded hover:bg-blue-600 transition"
                                                    >
                                                        {post.is_closed ? 'Open' : 'Close'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            updatePost({
                                                                id: post.id,
                                                                is_pinned: !post.is_pinned,
                                                            })
                                                        }}
                                                        className="px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded hover:bg-yellow-600 transition"
                                                    >
                                                        {post.is_pinned ? 'Unpin' : 'Pin'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Are you sure you want to delete "${post.title}"?`)) {
                                                                deletePost(post.id)
                                                            }
                                                        }}
                                                        className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-600 transition"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="mt-6 flex items-center justify-between border-t border-primary/10 pt-4">
                                <div className="text-sm text-primary/60">
                                    Page {page} of {totalPages} ({totalPosts} total posts)
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
