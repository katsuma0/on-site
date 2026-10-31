/* The Map tab: Apple Maps with a pin for every visitable Ontario provincial
   park (MapParks.swift). A favourite park's pin is a red heart, a park you
   have rated or written in is a blue check, a park in the guide is a green
   tent, and a park the guide does not cover yet is a grey leaf. Tapping a
   pin raises a glass card with what the park offers and a way in: the
   park's page in the app, Algonquin's campgrounds, or the official page.
   No location is asked for; the map opens framed on Ontario. */

import SwiftUI
import MapKit

struct ParkMapView: View {
    @ObservedObject var shell = ShellState.shared
    /// Extra room above the bottom safe area (the tab bar is already in it).
    var barClearance: CGFloat

    @State private var position: MapCameraPosition = .region(ParkMapView.ontario)
    @State private var selection: String?
    @Environment(\.openURL) private var openURL

    init(barClearance: CGFloat = 0) {
        self.barClearance = barClearance
    }

    static let ontario = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 47.6, longitude: -84.6),
        span: MKCoordinateSpan(latitudeDelta: 12.5, longitudeDelta: 22))

    private var selected: MapPark? {
        guard let slug = selection else { return nil }
        return MapPark.all.first { $0.slug == slug }
    }

    var body: some View {
        Map(position: $position,
            bounds: MapCameraBounds(minimumDistance: 1_500, maximumDistance: 6_000_000),
            selection: $selection) {
            ForEach(MapPark.all) { park in
                Marker(park.name, systemImage: symbol(for: park), coordinate: park.coordinate)
                    .tint(tint(for: park))
                    .tag(park.slug)
            }
        }
        .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
        .mapControls {
            MapCompass()
            MapScaleView()
        }
        .overlay(alignment: .bottom) {
            if let park = selected {
                ParkCard(park: park, lang: shell.language,
                         isFavourite: park.guideID.map { shell.favourites.contains($0) } ?? false,
                         isVisited: park.guideID.map { shell.visited.contains($0) } ?? false,
                         onOpen: { open(park) },
                         onOfficial: { if let url = URL(string: park.officialURL) { openURL(url) } },
                         onClose: { withAnimation(.snappy) { selection = nil } })
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .id(park.slug)
            }
        }
        // after the overlay, so the card, the controls and Apple's legal
        // line all sit above the tab bar while the map runs edge to edge
        .safeAreaPadding(.bottom, barClearance)
        .animation(.spring(response: 0.35, dampingFraction: 0.86), value: selection)
        .sensoryFeedback(.selection, trigger: selection)
        .onChange(of: shell.tab) { _, tab in
            if tab == .map { shell.refreshMapState() }
        }
    }

    private func open(_ park: MapPark) {
        if let id = park.guideID {
            shell.openPark(id)
        } else if park.isAlgonquin {
            shell.openAlgonquin()
        } else if let url = URL(string: park.officialURL) {
            openURL(url)
        }
    }

    private func symbol(for park: MapPark) -> String {
        guard let id = park.guideID else { return park.isAlgonquin ? "tent.fill" : "leaf.fill" }
        if shell.favourites.contains(id) { return "heart.fill" }
        if shell.visited.contains(id) { return "checkmark" }
        return "tent.fill"
    }

    private func tint(for park: MapPark) -> Color {
        guard let id = park.guideID else { return park.isAlgonquin ? .green : .gray }
        if shell.favourites.contains(id) { return .red }
        if shell.visited.contains(id) { return .blue }
        return .green
    }
}

/// The card a tapped pin raises.
private struct ParkCard: View {
    let park: MapPark
    let lang: String
    let isFavourite: Bool
    let isVisited: Bool
    let onOpen: () -> Void
    let onOfficial: () -> Void
    let onClose: () -> Void

    private var fr: Bool { lang == "fr" }

    private var kindsLine: String {
        park.kinds.map { kind -> String in
            switch kind {
            case .camping: return "Camping"
            case .backcountry: return fr ? "Arrière-pays" : "Backcountry"
            case .roofed: return fr ? "Hébergement avec toit" : "Roofed accommodation"
            case .dayUse: return fr ? "Activités de jour" : "Day use"
            }
        }.joined(separator: " · ")
    }

    private var status: String? {
        if isFavourite { return fr ? "Favori" : "Favourite" }
        if isVisited { return fr ? "Visité" : "Visited" }
        return nil
    }

    private var openTitle: String {
        if park.guideID != nil { return fr ? "Ouvrir le parc" : "Open park" }
        if park.isAlgonquin { return fr ? "Terrains de camping" : "Campgrounds" }
        return fr ? "Page officielle" : "Official page"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(park.name)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text(kindsLine)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if let status = status {
                        Text(status)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(isFavourite ? Color.red : Color.accentColor)
                    }
                }
                Spacer(minLength: 0)
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 30, height: 30)
                        .background(Color.primary.opacity(0.08), in: Circle())
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.top, -8)
                .padding(.trailing, -8)
                .accessibilityLabel(fr ? "Fermer" : "Close")
            }
            HStack(spacing: 10) {
                Button(action: onOpen) {
                    Text(openTitle)
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 34)
                }
                .modifier(ProminentButton())
                if park.guideID != nil || park.isAlgonquin {
                    Button(action: onOfficial) {
                        Text(fr ? "Page officielle" : "Official page")
                            .font(.body.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 34)
                    }
                    .modifier(SecondaryButton())
                }
            }
        }
        .padding(18)
        .frame(maxWidth: 520)
        .modifier(GlassCard())
    }
}

private struct ProminentButton: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.buttonStyle(.glassProminent)
        } else {
            content.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
        }
    }
}

private struct SecondaryButton: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.buttonStyle(.glass)
        } else {
            content.buttonStyle(.bordered).buttonBorderShape(.capsule)
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
