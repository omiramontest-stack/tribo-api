export interface UpdatePassDataDto {
  token: string
  action: 'add_stamp' | 'add_points' | 'renew_membership'
  amount?: number
}
