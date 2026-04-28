import { Group, Line, Rect, Text } from "react-konva";
import { BOARD_HEIGHT, BOARD_WIDTH, BOUNDARY_MARGIN } from "../utils/analysis";

interface SandboxGuideLayerProps {
  showGuides: boolean;
}

const thirdsX = [BOARD_WIDTH / 3, (BOARD_WIDTH * 2) / 3];
const thirdsY = [BOARD_HEIGHT / 3, (BOARD_HEIGHT * 2) / 3];

export function SandboxGuideLayer({ showGuides }: SandboxGuideLayerProps): JSX.Element {
  return (
    <Group>
      <Rect
        name="tray"
        x={0}
        y={0}
        width={BOARD_WIDTH}
        height={BOARD_HEIGHT}
        cornerRadius={18}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: BOARD_WIDTH, y: BOARD_HEIGHT }}
        fillLinearGradientColorStops={[0, "#ead2a3", 0.5, "#d8b77b", 1, "#cfa56a"]}
        stroke="#89673f"
        strokeWidth={8}
        shadowColor="#4d3822"
        shadowBlur={24}
        shadowOffset={{ x: 0, y: 12 }}
        shadowOpacity={0.2}
      />
      <Rect name="tray" x={13} y={BOARD_HEIGHT - 34} width={BOARD_WIDTH - 26} height={20} cornerRadius={10} fill="#9d7448" opacity={0.28} />

      {showGuides ? (
        <Group listening={false}>
          <Rect x={8} y={8} width={BOARD_WIDTH - 16} height={BOUNDARY_MARGIN - 8} fill="#fff8df" opacity={0.1} />
          <Rect x={8} y={BOARD_HEIGHT - BOUNDARY_MARGIN} width={BOARD_WIDTH - 16} height={BOUNDARY_MARGIN - 8} fill="#5b3d24" opacity={0.05} />
          <Rect x={8} y={BOUNDARY_MARGIN} width={BOUNDARY_MARGIN - 8} height={BOARD_HEIGHT - BOUNDARY_MARGIN * 2} fill="#fff8df" opacity={0.08} />
          <Rect x={BOARD_WIDTH - BOUNDARY_MARGIN} y={BOUNDARY_MARGIN} width={BOUNDARY_MARGIN - 8} height={BOARD_HEIGHT - BOUNDARY_MARGIN * 2} fill="#5b3d24" opacity={0.05} />

          {thirdsX.map((x) => (
            <Line key={`x-${x}`} points={[x, 12, x, BOARD_HEIGHT - 12]} stroke="#84633b" strokeWidth={1.5} dash={[9, 9]} opacity={0.38} />
          ))}
          {thirdsY.map((y) => (
            <Line key={`y-${y}`} points={[12, y, BOARD_WIDTH - 12, y]} stroke="#84633b" strokeWidth={1.5} dash={[9, 9]} opacity={0.38} />
          ))}

          <Rect
            x={BOARD_WIDTH / 3}
            y={BOARD_HEIGHT / 3}
            width={BOARD_WIDTH / 3}
            height={BOARD_HEIGHT / 3}
            cornerRadius={10}
            stroke="#2f8f83"
            strokeWidth={2}
            dash={[12, 8]}
            opacity={0.72}
          />
          <Rect x={BOUNDARY_MARGIN} y={BOUNDARY_MARGIN} width={BOARD_WIDTH - BOUNDARY_MARGIN * 2} height={BOARD_HEIGHT - BOUNDARY_MARGIN * 2} stroke="#b06124" strokeWidth={1.5} dash={[7, 8]} opacity={0.54} />

          {[
            ["左上", BOARD_WIDTH / 6, BOARD_HEIGHT / 6],
            ["上中", BOARD_WIDTH / 2, BOARD_HEIGHT / 6],
            ["右上", (BOARD_WIDTH * 5) / 6, BOARD_HEIGHT / 6],
            ["左中", BOARD_WIDTH / 6, BOARD_HEIGHT / 2],
            ["中心", BOARD_WIDTH / 2, BOARD_HEIGHT / 2],
            ["右中", (BOARD_WIDTH * 5) / 6, BOARD_HEIGHT / 2],
            ["左下", BOARD_WIDTH / 6, (BOARD_HEIGHT * 5) / 6],
            ["下中", BOARD_WIDTH / 2, (BOARD_HEIGHT * 5) / 6],
            ["右下", (BOARD_WIDTH * 5) / 6, (BOARD_HEIGHT * 5) / 6],
          ].map(([label, x, y]) => (
            <Text
              key={label as string}
              text={label as string}
              x={(x as number) - 22}
              y={(y as number) - 11}
              width={44}
              height={22}
              align="center"
              verticalAlign="middle"
              fontSize={14}
              fontStyle="600"
              fill="#5e482c"
              opacity={0.45}
            />
          ))}
        </Group>
      ) : null}
    </Group>
  );
}
