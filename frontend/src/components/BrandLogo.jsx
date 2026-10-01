const LOGO_SRC =
  'https://lh3.googleusercontent.com/aida/AEtjO1V5atYwR2bjdmMA6rH_VqNkUEZBBxUIfk3PD0heVkqxDyN2mA-tuHUP9e1ZblxCbq8yaVN-huq1tmunud5FNj3RabM1y8Mkq5RFqJfTIoGE0aN6mBw0krz4i_O2F9iTEAQnqaSKN1cqueauQ9mrr7Kjqg6a58urdIaUyOSI8WseIBVc7389AcTKRcWBWoGFGG8gfJjaUYkPleHvueLv-9kHKDSkGSVD0RuI0T3eadkv3-6Cz2qbORrR'

/** Inline SVG mark used when the remote logo is unavailable. */
function Mark({ className = '' }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M16 2.5 27.5 9v14L16 29.5 4.5 23V9L16 2.5Z"
        stroke="#00F0FF"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 17.5h4l2.5-6 3.5 11 2.5-6.5h4.5"
        stroke="#00F0FF"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function BrandLogo({ className = 'h-8 w-8', imgClassName = '' }) {
  return (
    <span className="inline-flex items-center">
      <img
        src={LOGO_SRC}
        alt="CloudPulse Brand Logo"
        className={`${className} w-auto object-contain ${imgClassName}`}
        onError={(e) => {
          e.currentTarget.style.display = 'none'
          e.currentTarget.nextElementSibling?.style.removeProperty('display')
        }}
      />
      <Mark className={`${className} w-auto hidden`} />
    </span>
  )
}
