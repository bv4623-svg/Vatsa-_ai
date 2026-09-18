import { BUSINESS, legalName, phoneHref, postalAddress } from "@/config/business";

/** The legal entity, address and contact details, rendered identically on
 * every page that shows them. The phone row appears only once a number is
 * configured -- nothing is invented in its place. */
export function BusinessInfo({ className = "" }: { className?: string }) {
  const tel = phoneHref();

  return (
    <dl className={`grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[9rem_1fr] ${className}`}>
      <dt className="font-semibold text-gray-700 dark:text-gray-300">Legal name</dt>
      <dd className="text-gray-600 dark:text-gray-400">{legalName()}</dd>

      <dt className="font-semibold text-gray-700 dark:text-gray-300">Address</dt>
      <dd className="text-gray-600 dark:text-gray-400">{postalAddress()}</dd>

      <dt className="font-semibold text-gray-700 dark:text-gray-300">Support email</dt>
      <dd>
        <a href={`mailto:${BUSINESS.supportEmail}`} className="text-blue-500 hover:underline">
          {BUSINESS.supportEmail}
        </a>
      </dd>

      {tel && (
        <>
          <dt className="font-semibold text-gray-700 dark:text-gray-300">Phone</dt>
          <dd>
            <a href={tel} className="text-blue-500 hover:underline">{BUSINESS.phone}</a>
          </dd>
        </>
      )}

      <dt className="font-semibold text-gray-700 dark:text-gray-300">Hours</dt>
      <dd className="text-gray-600 dark:text-gray-400">{BUSINESS.hours}</dd>
    </dl>
  );
}
