export interface PassDownloadToken {
  id: string
  passId: string
  passToken: string
  token: string
  expiresAt: string
  usedAt: string | null
  createdAt: string
}
