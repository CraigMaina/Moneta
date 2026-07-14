import { airtimeFixtures } from './airtime'
import { buyGoodsFixtures } from './buyGoods'
import { depositFixtures } from './deposit'
import type { Fixture } from './fixtureTypes'
import { fulizaDrawdownFixtures } from './fulizaDrawdown'
import { fulizaRepaymentFixtures } from './fulizaRepayment'
import { mshwariKcbTransferFixtures } from './mshwariKcbTransfer'
import { paybillFixtures } from './paybill'
import { pochiLaBiasharaFixtures } from './pochiLaBiashara'
import { receivedFixtures } from './received'
import { reversalFixtures } from './reversal'
import { sentToPersonFixtures } from './sentToPerson'
import { unmatchedFixtures } from './unmatched'
import { withdrawalFixtures } from './withdrawal'

export type { Fixture, MatchedFixture, UnmatchedFixture } from './fixtureTypes'

/** Every fixture across all 12 M-PESA format families, plus deliberate non-matches. */
export const allFixtures: Fixture[] = [
  ...receivedFixtures,
  ...sentToPersonFixtures,
  ...paybillFixtures,
  ...buyGoodsFixtures,
  ...pochiLaBiasharaFixtures,
  ...withdrawalFixtures,
  ...depositFixtures,
  ...airtimeFixtures,
  ...fulizaDrawdownFixtures,
  ...fulizaRepaymentFixtures,
  ...mshwariKcbTransferFixtures,
  ...reversalFixtures,
  ...unmatchedFixtures,
]

export {
  receivedFixtures,
  sentToPersonFixtures,
  paybillFixtures,
  buyGoodsFixtures,
  pochiLaBiasharaFixtures,
  withdrawalFixtures,
  depositFixtures,
  airtimeFixtures,
  fulizaDrawdownFixtures,
  fulizaRepaymentFixtures,
  mshwariKcbTransferFixtures,
  reversalFixtures,
  unmatchedFixtures,
}
