import type { SVGProps } from 'react'
import type { StampIcon } from '../lib/stampIcons'

type Props = { icon: StampIcon } & Omit<SVGProps<SVGSVGElement>, 'viewBox'>

export default function StampIconSvg({ icon, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={icon.strokeWidth ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {icon.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
