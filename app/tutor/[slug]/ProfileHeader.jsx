import { Avatar } from "@/components/ui";
import { ProfileHeaderText } from "./ProfileHeaderText";

/**
 * The profile header, without a card. Shared by the public profile
 * (PublicProfileView) and the owner editor (OwnerProfile) so both render the
 * identical header.
 *
 * A banner appears ONLY if the tutor uploaded one (120px on phones, 160px from
 * sm, 4px corners, page width), and the 112px circle photo overlaps its
 * bottom-left edge with a white ring. With no banner there is no strip, no
 * generated gradient and no placeholder: the photo and name simply start the
 * page. The header ends with a rule, like every section below it.
 *
 * `children` renders inside the header's positioning context, for the public
 * page's bookmark (top right).
 */
export function ProfileHeader({ tutor, deliveryLabel, children }) {
  const banner = tutor.bannerImg;
  return (
    <header className="relative border-b border-[color:var(--paper-line)] pb-6">
      {children}
      {banner && (
        <div
          className="h-[120px] sm:h-[160px] rounded"
          style={{ background: `url(${banner}) center / cover no-repeat` }}
        />
      )}
      <div className={banner ? "-mt-14 pl-4 sm:pl-6" : ""}>
        <Avatar tutor={tutor} size={112} ring={!!banner} />
      </div>
      <ProfileHeaderText tutor={tutor} deliveryLabel={deliveryLabel} />
    </header>
  );
}
