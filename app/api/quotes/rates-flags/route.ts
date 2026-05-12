import {
  handleRatesFlagsRouteBatchPublish,
  handleRatesFlagsRouteGet,
} from '@/lib/server/ratesFlagsRoute'

export async function GET(request: Request) {
  return handleRatesFlagsRouteGet(request)
}

export async function PUT(request: Request) {
  return handleRatesFlagsRouteBatchPublish(request)
}
