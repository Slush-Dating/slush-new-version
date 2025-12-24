import { useState, useEffect, useRef } from 'react';
import { MapPin, Play, Edit2, Pause, Volume2, VolumeX, Settings as SettingsIcon, Star, StarOff } from 'lucide-react';
import { Settings } from './Settings';
import { authService } from '../services/authService';
import { getApiBaseUrl } from '../services/apiConfig';
import './Profile.css';

interface ProfileProps {
    onLogout: () => void;
}

const MediaCard = ({ 
    url, 
    type, 
    isProfilePhoto, 
    onSetAsProfilePhoto 
}: { 
    url: string; 
    type: 'photo' | 'video';
    isProfilePhoto?: boolean;
    onSetAsProfilePhoto?: () => void;
}) => {
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const getImageUrl = (imageUrl: string) => {
        if (!imageUrl) return '';
        if (imageUrl.startsWith('http')) return imageUrl;
        const apiBaseUrl = getApiBaseUrl();
        const serverBaseUrl = apiBaseUrl.replace('/api', '');
        return `${serverBaseUrl}${imageUrl}`;
    };
    const fullUrl = getImageUrl(url);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMuted(!isMuted);
    };

    const handleSetAsProfilePhoto = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onSetAsProfilePhoto && type === 'photo') {
            onSetAsProfilePhoto();
        }
    };

    if (type === 'video') {
        return (
            <div className="profile-media-card video">
                <video
                    ref={videoRef}
                    src={fullUrl}
                    loop
                    muted={isMuted}
                    autoPlay
                    playsInline
                    onClick={togglePlay}
                />
                <div className="video-controls">
                    <button onClick={togglePlay} className="video-control-btn">
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button onClick={toggleMute} className="video-control-btn">
                        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-media-card photo">
            <img src={fullUrl} alt="Profile media" />
            {type === 'photo' && (
                <div className="photo-actions">
                    {isProfilePhoto ? (
                        <div className="profile-photo-badge" title="Current profile photo">
                            <Star size={16} fill="currentColor" />
                        </div>
                    ) : (
                        onSetAsProfilePhoto && (
                            <button 
                                className="set-profile-photo-btn" 
                                onClick={handleSetAsProfilePhoto}
                                title="Set as profile photo"
                                aria-label="Set as profile photo"
                            >
                                <StarOff size={16} />
                            </button>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export const Profile: React.FC<ProfileProps> = ({ onLogout }) => {
    const [showSettings, setShowSettings] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isBioExpanded, setIsBioExpanded] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [editForm, setEditForm] = useState({
        name: '',
        bio: '',
        interests: [] as string[]
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
    const [uploadedVideos, setUploadedVideos] = useState<string[]>([]);

    useEffect(() => {
        const fetchProfile = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const data = await authService.getProfile(token);
                    setUser(data);
                    setEditForm({
                        name: data.name || '',
                        bio: data.bio || '',
                        interests: data.interests || []
                    });
                } catch (err) {
                    console.error('Failed to fetch profile:', err);
                }
            }
            setLoading(false);
        };
        fetchProfile();
    }, []);

    if (loading) return <div className="profile-wrapper"><div className="spinner"></div></div>;
    if (!user) return <div className="profile-wrapper">User not found</div>;

    const calculateAge = (dob: string) => {
        if (!dob) return '';
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const photos = user.photos || [];
    const videos = user.videos || [];
    const interests = user.interests || [];

    // Combine all media for hero carousel (videos first, then photos)
    const allHeroMedia = [...videos, ...photos];
    const currentHeroMedia = allHeroMedia[activeImageIndex];
    const isCurrentHeroVideo = currentHeroMedia && videos.includes(currentHeroMedia);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingFiles(true);
        const token = localStorage.getItem('token');
        if (!token) {
            setError('Authentication required');
            return;
        }

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const result = await authService.uploadFile(token, file);

                // Check if it's an image or video
                if (file.type.startsWith('image/')) {
                    setUploadedPhotos(prev => [...prev, result.url]);
                } else if (file.type.startsWith('video/')) {
                    setUploadedVideos(prev => [...prev, result.url]);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to upload file');
        } finally {
            setUploadingFiles(false);
        }
    };

    const removePhoto = (index: number) => {
        const currentPhotos = [...photos];
        const uploadedPhotosList = [...uploadedPhotos];

        if (index < currentPhotos.length) {
            // Remove from existing photos
            currentPhotos.splice(index, 1);
            setUser({ ...user, photos: currentPhotos });
        } else {
            // Remove from uploaded photos
            const uploadedIndex = index - currentPhotos.length;
            uploadedPhotosList.splice(uploadedIndex, 1);
            setUploadedPhotos(uploadedPhotosList);
        }
    };

    const removeVideo = (index: number) => {
        const currentVideos = [...videos];
        const uploadedVideosList = [...uploadedVideos];

        if (index < currentVideos.length) {
            // Remove from existing videos
            currentVideos.splice(index, 1);
            setUser({ ...user, videos: currentVideos });
        } else {
            // Remove from uploaded videos
            const uploadedIndex = index - currentVideos.length;
            uploadedVideosList.splice(uploadedIndex, 1);
            setUploadedVideos(uploadedVideosList);
        }
    };

    const setAsProfilePhoto = async (photoIndex: number) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Authentication required');
                return;
            }

            // Create a new photos array with the selected photo moved to the first position
            const currentPhotos = [...photos];
            const selectedPhoto = currentPhotos[photoIndex];
            
            // Remove the photo from its current position
            currentPhotos.splice(photoIndex, 1);
            // Add it to the beginning
            const reorderedPhotos = [selectedPhoto, ...currentPhotos];

            // Update backend
            await authService.updateOnboarding(token, { photos: reorderedPhotos });

            // Update local state
            setUser({ ...user, photos: reorderedPhotos });
            
            // Also update activeImageIndex if needed (if we're viewing the hero image)
            if (activeImageIndex === photoIndex + videos.length) {
                setActiveImageIndex(videos.length); // First photo is now at videos.length index
            }
        } catch (err: any) {
            setError(err.message || 'Failed to set profile photo');
        }
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Authentication required');
                return;
            }

            // Validate form
            if (!editForm.name.trim()) {
                setError('Name is required');
                return;
            }

            const updates: any = {
                name: editForm.name.trim(),
                bio: editForm.bio.trim(),
                interests: editForm.interests
            };

            // Add uploaded media to the updates
            if (uploadedPhotos.length > 0) {
                updates.photos = [...(user.photos || []), ...uploadedPhotos];
            }
            if (uploadedVideos.length > 0) {
                updates.videos = [...(user.videos || []), ...uploadedVideos];
            }

            await authService.updateOnboarding(token, updates);

            // Update local user state
            setUser({ ...user, ...updates });
            setIsEditMode(false);
            setUploadedPhotos([]);
            setUploadedVideos([]);
        } catch (err: any) {
            setError(err.message || 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="profile-wrapper dark-theme">
            {/* Animated background orbs */}
            <div className="profile-orbs">
                <div className="profile-orb profile-orb-1" />
                <div className="profile-orb profile-orb-2" />
                <div className="profile-orb profile-orb-3" />
            </div>
            {!showSettings ? (
                <div className="profile-container-new profile-page-enter">
                            {/* 1. Large Photo/Video Header */}
                            <header className="profile-hero">
                                <div className="hero-overlay-gradient" />
                                <div className="hero-overlay-top">
                                    <button className="hero-btn settings-btn" onClick={() => setShowSettings(true)}>
                                        <SettingsIcon size={20} />
                                    </button>
                                </div>

                            {/* Show video or image based on current media */}
                            {currentHeroMedia ? (
                                isCurrentHeroVideo ? (
                                    <video
                                        src={(() => {
                                            if (currentHeroMedia.startsWith('http')) return currentHeroMedia;
                                            const apiBaseUrl = getApiBaseUrl();
                                            const serverBaseUrl = apiBaseUrl.replace('/api', '');
                                            return `${serverBaseUrl}${currentHeroMedia}`;
                                        })()}
                                        className="hero-image"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                    />
                                ) : (
                                    <img
                                        src={(() => {
                                            if (currentHeroMedia.startsWith('http')) return currentHeroMedia;
                                            const apiBaseUrl = getApiBaseUrl();
                                            const serverBaseUrl = apiBaseUrl.replace('/api', '');
                                            return `${serverBaseUrl}${currentHeroMedia}`;
                                        })()}
                                        alt="Profile media"
                                        className="hero-image"
                                    />
                                )
                            ) : (
                                <div className="hero-placeholder">
                                    <img
                                        src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80"
                                        alt="Profile placeholder"
                                        className="hero-image"
                                    />
                                </div>
                            )}

                            <div className="hero-pagination">
                                {Array.from({ length: Math.max(1, allHeroMedia.length) }).map((_, i) => (
                                    <span
                                        key={i}
                                        className={`dot ${i === activeImageIndex ? 'active' : ''}`}
                                        onClick={() => setActiveImageIndex(i)}
                                    />
                                ))}
                            </div>

                            {/* Edit Profile Entry Point */}
                            <button
                                className="hero-edit-fab"
                                onClick={() => setIsEditMode(!isEditMode)}
                                aria-label="Edit Profile"
                            >
                                <Edit2 size={18} />
                                <span>{isEditMode ? 'Cancel Edit' : 'Edit Profile'}</span>
                            </button>
                        </header>

                        {/* 2. Content Body */}
                        <main className="profile-content-body">
                            {isEditMode ? (
                                /* Edit Mode */
                                <div className="edit-form-container">
                                    {error && <div className="error-message">{error}</div>}

                                    {/* Name Field */}
                                    <section className="edit-section">
                                        <label className="edit-label">Name</label>
                                        <input
                                            type="text"
                                            className="edit-input"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            placeholder="Enter your name"
                                        />
                                    </section>

                                    {/* Bio Field */}
                                    <section className="edit-section">
                                        <label className="edit-label">About</label>
                                        <textarea
                                            className="edit-textarea"
                                            value={editForm.bio}
                                            onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                            placeholder="Tell others about yourself..."
                                            rows={4}
                                        />
                                    </section>

                                    {/* Interests Field */}
                                    <section className="edit-section">
                                        <label className="edit-label">Interests</label>
                                        <div className="interests-input-container">
                                            <input
                                                type="text"
                                                className="edit-input"
                                                placeholder="Add an interest and press Enter"
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const value = e.currentTarget.value.trim();
                                                        if (value && !editForm.interests.includes(value)) {
                                                            setEditForm({
                                                                ...editForm,
                                                                interests: [...editForm.interests, value]
                                                            });
                                                            e.currentTarget.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <div className="interests-preview">
                                                {editForm.interests.map((interest, index) => (
                                                    <span key={index} className="interest-pill editable">
                                                        {interest}
                                                        <button
                                                            className="remove-interest"
                                                            onClick={() => setEditForm({
                                                                ...editForm,
                                                                interests: editForm.interests.filter((_, i) => i !== index)
                                                            })}
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </section>

                                    {/* Media Upload Section */}
                                    <section className="edit-section">
                                        <label className="edit-label">Photos & Videos</label>
                                        <div className="media-upload-container">
                                            <input
                                                type="file"
                                                id="media-upload"
                                                accept="image/*,video/*"
                                                multiple
                                                style={{ display: 'none' }}
                                                onChange={handleFileUpload}
                                                disabled={uploadingFiles}
                                            />
                                            <label htmlFor="media-upload" className="upload-btn">
                                                {uploadingFiles ? 'Uploading...' : 'Add Photos/Videos'}
                                            </label>

                                            {/* Current Media Preview */}
                                            <div className="current-media-preview">
                                                <h5 className="media-preview-title">Current Photos</h5>
                                                <div className="media-preview-grid">
                                                    {[...photos, ...uploadedPhotos].map((photo, index) => {
                                                        const photoUrl = photo.startsWith('http') ? photo : (() => {
                                                            const apiBaseUrl = getApiBaseUrl();
                                                            const serverBaseUrl = apiBaseUrl.replace('/api', '');
                                                            return `${serverBaseUrl}${photo}`;
                                                        })();
                                                        return (
                                                            <div key={`photo-${index}`} className="media-preview-item">
                                                                <img src={photoUrl} alt="Profile photo" />
                                                                <button
                                                                    className="remove-media-btn"
                                                                    onClick={() => removePhoto(index)}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <h5 className="media-preview-title">Current Videos</h5>
                                                <div className="media-preview-grid">
                                                    {[...videos, ...uploadedVideos].map((video, index) => {
                                                        const videoUrl = video.startsWith('http') ? video : (() => {
                                                            const apiBaseUrl = getApiBaseUrl();
                                                            const serverBaseUrl = apiBaseUrl.replace('/api', '');
                                                            return `${serverBaseUrl}${video}`;
                                                        })();
                                                        return (
                                                            <div key={`video-${index}`} className="media-preview-item">
                                                                <video src={videoUrl} />
                                                                <button
                                                                    className="remove-media-btn"
                                                                    onClick={() => removeVideo(index)}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Save/Cancel Buttons */}
                                    <div className="edit-actions">
                                        <button
                                            className="edit-btn cancel"
                                            onClick={() => {
                                                setIsEditMode(false);
                                                setError('');
                                                // Reset form to original values
                                                setEditForm({
                                                    name: user.name || '',
                                                    bio: user.bio || '',
                                                    interests: user.interests || []
                                                });
                                            }}
                                            disabled={saving}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="edit-btn save"
                                            onClick={handleSaveProfile}
                                            disabled={saving}
                                        >
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* View Mode */
                                <>
                                    {/* Identity Section */}
                                    <section className="section-identity">
                                        <div className="identity-header">
                                            <h1 className="name-age">{user.name}, {calculateAge(user.dob)}</h1>
                                            <p className="profession">Professional model</p>
                                        </div>

                                        <div className="location-row">
                                            <div className="location-text">
                                                <h4 className="section-label">Location</h4>
                                                <p className="location-val">{user.locationString || 'Sheffield, UK'}</p>
                                            </div>
                                            <div className="distance-pill">
                                                <MapPin size={14} /> Nearby
                                            </div>
                                        </div>
                                    </section>

                                    {/* About Section */}
                                    <section className="section-about">
                                        <h4 className="section-label">About</h4>
                                        <div className={`bio-container ${isBioExpanded ? 'expanded' : ''}`}>
                                            <p className="bio-text">
                                                {user.bio || "My name is Jessica Parker and I enjoy meeting new people and finding ways to help them have an uplifting experience. I enjoy reading.."}
                                            </p>
                                            {!isBioExpanded && <div className="bio-fade-overlay" />}
                                        </div>
                                        <button className="read-more-btn" onClick={() => setIsBioExpanded(!isBioExpanded)}>
                                            {isBioExpanded ? 'Read less' : 'Read more'}
                                        </button>
                                    </section>

                                    {/* Interests Section */}
                                    <section className="section-interests">
                                        <h4 className="section-label">Interests</h4>
                                        <div className="interests-grid-pills">
                                            {interests.length > 0 ? interests.map((item: string) => (
                                                <span key={item} className="interest-pill">{item}</span>
                                            )) : (
                                                ['Travelling', 'Modeling', 'Dancing', 'Books', 'Music', 'Dancing'].map((item, i) => (
                                                    <span key={i} className="interest-pill">{item}</span>
                                                ))
                                            )}
                                        </div>
                                    </section>

                                    {/* Unified Media Gallery */}
                                    <section className="section-media-gallery">
                                        <h4 className="section-label">Gallery</h4>
                                        <div className="media-gallery-grid">
                                            {/* All photos and videos in one responsive grid */}
                                            {[...videos, ...photos].map((media, index) => {
                                                const isVideo = videos.includes(media);
                                                const photoIndex = index - videos.length;
                                                const isProfilePhoto = !isVideo && photoIndex === 0;
                                                return (
                                                    <div key={index} className="media-gallery-item">
                                                        <MediaCard 
                                                            url={media} 
                                                            type={isVideo ? "video" : "photo"}
                                                            isProfilePhoto={isProfilePhoto}
                                                            onSetAsProfilePhoto={!isVideo ? () => setAsProfilePhoto(photoIndex) : undefined}
                                                        />
                                                    </div>
                                                );
                                            })}

                                            {/* Media count is now handled by the backend defaults if empty */}
                                            {photos.length === 0 && videos.length === 0 && (
                                                <div className="no-media-message">
                                                    <p>Upload photos to your gallery</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                </>
                            )}
                        </main>
                    </div>
                ) : (
                    <Settings onBack={() => setShowSettings(false)} onLogout={onLogout} />
                )}
        </div>
    );
};
