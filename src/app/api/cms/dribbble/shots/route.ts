import { requireOwner } from '@/lib/cms/auth';
import { cmsErrorResponse, cmsResponse } from '@/lib/cms/http';
import { readPortfolio } from '@/lib/cms/repository';
import { getDribbbleShots } from '@/lib/dribbble';

export async function GET(request: Request) {
  try {
    const token = await requireOwner(request);
    const [shots, portfolio] = await Promise.all([getDribbbleShots(), readPortfolio(token)]);
    return cmsResponse({
      shots,
      selection: { designs: portfolio.data.designs, sha: portfolio.sha },
    });
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
