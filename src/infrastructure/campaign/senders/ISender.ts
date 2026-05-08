export interface SendPayload {
  to: string
  body: string
  organizationName: string
  passUrl?: string
  passToken?: string
}

export interface ISender {
  send(payload: SendPayload): Promise<void>
}
