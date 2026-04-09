import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { shadowCard, U } from "../../theme/tokens";

export function StateSkeleton(props: { count?: number }) {
  const count = props.count ?? 5;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const animatedStyle = {
    opacity: shimmer.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.5, 1, 0.5]
    })
  } as const;

  return (
    <View style={{ padding: U.space(2) }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={`sk-${i}`}
          style={{
            backgroundColor: U.surface,
            borderRadius: U.radiusLg,
            borderWidth: 0,
            padding: U.space(2),
            marginBottom: U.space(1.25),
            overflow: "hidden",
            ...shadowCard
          }}
        >
          <Animated.View
            style={[
              { height: U.space(1.75), width: "65%", backgroundColor: U.surfaceContainer, borderRadius: U.space(0.75) },
              animatedStyle
            ]}
          />
          <Animated.View
            style={[
              {
                height: U.space(1.5),
                width: "45%",
                backgroundColor: U.surfaceLow,
                borderRadius: U.space(0.75),
                marginTop: U.space(1)
              },
              animatedStyle
            ]}
          />
          <Animated.View
            style={[
              {
                height: U.space(1.5),
                width: "55%",
                backgroundColor: U.surfaceLow,
                borderRadius: U.space(0.75),
                marginTop: U.space(1)
              },
              animatedStyle
            ]}
          />
        </View>
      ))}
    </View>
  );
}
