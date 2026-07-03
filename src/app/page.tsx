import { redirect } from 'next/navigation';
import { postLoginPath } from '@/lib/authRedirect';
import { getPublicTicketPreviewDate } from '@/lib/publicTicketPreview';
import { DetailsPreviewClient } from './admin/details-preview/DetailsPreviewClient';

type HomeSearchParams = Record<string, string | string[] | undefined>;

function hasParam(searchParams: HomeSearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? Boolean(value[0]) : Boolean(value);
}

function callbackQuery(searchParams: HomeSearchParams) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined) params.append(key, item);
      });
      return;
    }

    if (value !== undefined) {
      params.set(key, value);
    }
  });

  params.set('next', postLoginPath);
  return params.toString();
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<HomeSearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  if (
    hasParam(resolvedSearchParams, 'error') ||
    hasParam(resolvedSearchParams, 'error_code') ||
    hasParam(resolvedSearchParams, 'error_description')
  ) {
    redirect('/');
  }

  if (hasParam(resolvedSearchParams, 'code')) {
    redirect(`/auth/callback?${callbackQuery(resolvedSearchParams)}`);
  }

  const initialPublicTicketDate = await getPublicTicketPreviewDate();

  return (
    <DetailsPreviewClient
      asLandingPage
      initialPublicTicketDate={initialPublicTicketDate}
    />
  );
}
