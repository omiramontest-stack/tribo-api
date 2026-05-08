export interface UpdatePassDataDto {
  token: string
  adminId: string
  organizationId: string
  action: 'add_stamp' | 'add_points' | 'renew_membership' | 'add_cashback' | 'subtract_cashback'
  amount?: number
  purchaseAmount?: number
  cashbackPercent?: number
  description?: string
}
