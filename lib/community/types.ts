export type Comment = { id: string; text: string; createdAt: string; user: { username: string } }
export type Post = { id: string; title: string; description: string; mediaType: 'IMAGE' | 'VIDEO'; thumbnailUrl: string | null; createdAt: string; comments: Comment[] }
