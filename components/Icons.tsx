import Svg, { Circle, Path } from 'react-native-svg';

export const STAR_PATH =
  'M12 2.15l2.62 5.86 6.38.62-4.8 4.22 1.46 6.25L12 16.15 6.34 19.1l1.46-6.25-4.8-4.22 6.38-.62L12 2.15z';

type IconProps = {
  color: string;
  size?: number;
};

export function SearchIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="6.25" stroke={color} strokeWidth={1.8} />
      <Path d="M16.1 16.2L20.2 20.3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function StarIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR_PATH} fill={color} />
    </Svg>
  );
}

export function ChevronLeftIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14.5 5.5L8 12l6.5 6.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TrashIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 7.5h14" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M9.5 7.4V5.8h5v1.6" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7.4 7.5l.8 12h7.6l.8-12" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    </Svg>
  );
}
