import {
  handleRatesFlagsRouteActivate,
  handleRatesFlagsRouteGet,
  handleRatesFlagsRouteMutation,
} from '@/lib/server/ratesFlagsRoute'

export async function GET(request: Request) {
  return handleRatesFlagsRouteGet(request)
}

export async function PUT(request: Request) {
  return handleRatesFlagsRouteMutation(request)
}

export async function PATCH(request: Request) {
  return handleRatesFlagsRouteMutation(request)
}

export async function POST(request: Request) {
  return handleRatesFlagsRouteActivate(request)
}
