/* The tab bar, drawn natively: a floating Liquid Glass capsule with a
   lighter pill under the selected tab, as in Find My on iOS 26. On iOS 26
   it is real Liquid Glass (glassEffect, interactive, so it flexes under a
   finger); on iOS 17 and 18 it falls back to the system's thin material
   with the same shape. It steps aside while a sheet or the photo viewer
   covers the page, and the keyboard never pushes it up. */

import SwiftUI
import UIKit

struct GlassTabBar: View {
    @ObservedObject var shell = ShellState.shared
    @Environment(\.colorScheme) private var scheme
    @Namespace private var pill

    // Find My's measurements on an iPhone 17 Pro: a 58pt capsule, 25pt
    // from each side and 21pt above the bottom edge, the selected pill
    // inset 4pt inside it.
    private let barHeight: CGFloat = 58
    private let inset: CGFloat = 4

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases) { item in
                tabButton(item)
            }
        }
        .padding(inset)
        .frame(height: barHeight)
        .modifier(GlassCapsule(interactive: true))
        .frame(maxWidth: 560)
        .padding(.horizontal, 25)
        .sensoryFeedback(.selection, trigger: shell.tab)
    }

    private func tabButton(_ item: AppTab) -> some View {
        let selected = shell.tab == item
        return Button {
            withAnimation(.spring(response: 0.34, dampingFraction: 0.8)) {
                shell.select(item)
            }
        } label: {
            VStack(spacing: 2) {
                Image(systemName: item.symbol)
                    .symbolVariant(selected ? .fill : .none)
                    .font(.system(size: 19, weight: .medium))
                    .frame(height: 24)
                Text(item.title(shell.language))
                    .font(.system(size: 10, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(selected ? Color.accentColor : Color.primary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background {
                if selected {
                    Capsule()
                        .fill(Color.black.opacity(scheme == .dark ? 0.28 : 0.07))
                        .matchedGeometryEffect(id: "pill", in: pill)
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.title(shell.language))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// Liquid Glass on iOS 26, the thin system material before it.
struct GlassCapsule: ViewModifier {
    var interactive = false

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular.interactive(interactive), in: Capsule())
        } else {
            content
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5))
                .shadow(color: .black.opacity(0.18), radius: 16, y: 6)
        }
    }
}

/// The same glass on a rounded card (the map's park card).
struct GlassCard: ViewModifier {
    var radius: CGFloat = 28

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
        } else {
            content
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
                .shadow(color: .black.opacity(0.18), radius: 16, y: 6)
        }
    }
}

/// How far the bar sits from the bottom edge: 21pt on a phone with a home
/// indicator, as Find My does, and 10pt where there is none.
enum BarMetrics {
    static func bottomGap(safeBottom: CGFloat) -> CGFloat {
        safeBottom > 0 ? 21 : 10
    }
}
