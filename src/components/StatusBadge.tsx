import styled from 'styled-components'

const Badge = styled.span<{ $tone: 'success' | 'warning' | 'neutral' }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${({ $tone }) => ({ success: '#39785f', warning: '#9a702f', neutral: '#66756f' })[$tone]};
  font-size: 10px;
  line-height: 1.4;

  &::before {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $tone }) => ({ success: '#55a47c', warning: '#d2a454', neutral: '#9aa59f' })[$tone]};
    content: '';
  }
`

export function StatusBadge({
  tone,
  children,
}: React.PropsWithChildren<{ tone: 'success' | 'warning' | 'neutral' }>) {
  return <Badge $tone={tone}>{children}</Badge>
}
