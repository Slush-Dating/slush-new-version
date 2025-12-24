import React, { useState } from 'react';
// import { motion, AnimatePresence } from 'framer-motion'; // Temporarily disabled for debugging
import { authService } from '../services/authService';
import { getMediaBaseUrl } from '../services/apiConfig';
import { getVideoFileMetadata } from '../utils/mediaUtils';
import { ChevronRight, ChevronLeft, Camera, Sparkles, Check } from 'lucide-react';
import './Onboarding.css';

// Add error boundary wrapper to catch any rendering errors
class OnboardingErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('Onboarding Error Boundary caught error:', error);
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Onboarding component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '20px', color: 'red', textAlign: 'center'}}>
          <h2>Onboarding Error</h2>
          <p>There was an error loading the onboarding component. Please refresh the page.</p>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface OnboardingProps {
    token: string;
    onComplete: (user: any) => void;
}

const INTERESTS_OPTIONS = [
    'Hiking', 'Cooking', 'Gaming', 'Travel', 'Music', 'Movies', 'Art',
    'Fitness', 'Photography', 'Reading', 'Coffee', 'Wine', 'Dancing',
    'Yoga', 'Pets', 'Nature', 'Tech', 'Fashion', 'Foodie'
];

// Main Onboarding component
function OnboardingComponent({ token, onComplete }: OnboardingProps) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        dob: '',
        gender: 'woman',
        interestedIn: 'everyone',
        bio: '',
        interests: [] as string[],
        prompts: [
            { question: 'A life goal of mine is...', answer: '' },
            { question: 'My simple pleasures include...', answer: '' }
        ],
        photos: [] as string[],
        videos: [] as string[]
    });
    const [uploading, setUploading] = useState<string | null>(null);
    const [validating, setValidating] = useState<string | null>(null);

    // Validate video URL is accessible and playable
    const validateVideoUrl = (url: string): Promise<boolean> => {
        return new Promise((resolve) => {
            try {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.crossOrigin = 'anonymous';

                const timeout = setTimeout(() => {
                    video.remove();
                    resolve(false); // Timeout after 10 seconds
                }, 10000);

                video.onloadedmetadata = () => {
                    clearTimeout(timeout);
                    video.remove();
                    resolve(true); // Video is valid and metadata loaded
                };

                video.onerror = () => {
                    clearTimeout(timeout);
                    video.remove();
                    resolve(false); // Video failed to load
                };

                video.src = url;
            } catch (error) {
                console.warn('Error creating video element for validation:', error);
                resolve(false);
            }
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video', retryCount = 0) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // File size limits: 100MB for video, 20MB for photo
        const limitMB = type === 'video' ? 100 : 20;
        const maxSize = limitMB * 1024 * 1024;
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);

        if (file.size > maxSize) {
            alert(`File is ${fileSizeMB}MB, which exceeds the ${limitMB}MB limit. Please choose a smaller file.`);
            return;
        }

        // Validate file type
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/mov'];

        if (type === 'photo' && !validImageTypes.includes(file.type)) {
            alert('Please select a valid image file (JPEG, PNG, WebP)');
            return;
        }

        if (type === 'video' && !validVideoTypes.includes(file.type)) {
            alert('Please select a valid video file (MP4, MOV)');
            return;
        }

        // For videos, check duration and inform user about auto-trim
        if (type === 'video') {
            try {
                const metadata = await getVideoFileMetadata(file);
                if (metadata && metadata.duration && metadata.duration > 30) {
                    console.log(`Video is ${Math.round(metadata.duration)}s - will be auto-trimmed to 30s`);
                }
                console.log(`Video metadata: ${metadata?.duration?.toFixed(1)}s, ${metadata?.width}x${metadata?.height}, ${fileSizeMB}MB`);
            } catch (err) {
                console.warn('Could not read video metadata, proceeding with upload:', err);
            }
        }

        setUploading(type);

        try {
            // Upload directly - server handles compression via FFmpeg
            console.log(`Uploading ${type}: ${fileSizeMB}MB`);
            const uploadResult = await authService.uploadFile(token, file);

            // Check if video processing failed and fell back to original file
            if (type === 'video' && uploadResult.fallback) {
                const errorMessage = uploadResult.processingError || 'Video processing failed - using original file which may be large or incompatible.';
                console.warn('Video upload fallback:', errorMessage);

                // Offer retry for processing failures
                if (retryCount < 2) {
                    const retry = confirm(`${errorMessage}\n\nWould you like to retry uploading this file? (${retryCount + 1}/3 attempts)`);
                    if (retry) {
                        // Reset the input and try again
                        e.target.value = '';
                        setTimeout(() => {
                            handleFileChange(e, type, retryCount + 1);
                        }, 100);
                        return;
                    }
                }

                // Show warning but still allow the upload
                const proceed = confirm(`${errorMessage}\n\nThe video was uploaded but may not play properly or be very large. Do you want to use it anyway?`);

                if (!proceed) {
                    return; // Don't add the video to the form data
                }
            }

            // For videos, validate that the uploaded video is actually playable
            if (type === 'video') {
                const fullUrl = `${getMediaBaseUrl()}${uploadResult.url}`;
                console.log('Validating video URL:', fullUrl);

                setValidating('video');
                const isValid = await validateVideoUrl(fullUrl);
                setValidating(null);

                if (!isValid) {
                    if (retryCount < 2) {
                        const retry = confirm(`The uploaded video appears to be corrupted or incompatible. Would you like to retry uploading this file? (${retryCount + 1}/3 attempts)`);
                        if (retry) {
                            // Reset the input and try again
                            e.target.value = '';
                            setTimeout(() => {
                                handleFileChange(e, type, retryCount + 1);
                            }, 100);
                            return;
                        }
                    }
                    alert('The uploaded video appears to be corrupted or incompatible. Please try uploading a different video file.');
                    return; // Don't add invalid video to form data
                }
            }

            setFormData(prev => ({
                ...prev,
                [type === 'photo' ? 'photos' : 'videos']: [...prev[type === 'photo' ? 'photos' : 'videos'], uploadResult.url]
            }));
        } catch (err: any) {
            console.error('Upload failed:', err);

            let errorMessage = 'Upload failed. Please try again.';
            let suggestions = '';

            // Handle specific error types
            if (err?.message?.includes('413') || err?.message?.includes('too large')) {
                errorMessage = 'File is too large for upload.';
                suggestions = 'Try compressing the video or choose a smaller file.';
            } else if (err?.message?.includes('timeout')) {
                errorMessage = 'Upload timed out.';
                suggestions = 'Check your internet connection and try again.';
            } else if (err?.message?.includes('network') || err?.message?.includes('Failed to fetch')) {
                errorMessage = 'Network error occurred.';
                suggestions = 'Check your internet connection and try again.';
            } else if (err?.message?.includes('FFmpeg') || err?.message?.includes('processing')) {
                errorMessage = 'Video processing failed.';
                suggestions = 'Try a different video format or contact support.';
            } else if (err?.message?.includes('compression')) {
                errorMessage = 'Video compression failed.';
                suggestions = 'The original file will be uploaded. Please try again.';
            }

            const fullMessage = suggestions ? `${errorMessage}\n\n${suggestions}` : errorMessage;
            alert(fullMessage);
        } finally {
            setUploading(null);
            // Reset the input so the same file can be selected again if needed
            e.target.value = '';
        }
    };

    const nextStep = () => setStep((s: number) => s + 1);
    const prevStep = () => setStep((s: number) => s - 1);

    const toggleInterest = (interest: string) => {
        setFormData(prev => {
            const interests = prev.interests.includes(interest)
                ? prev.interests.filter(i => i !== interest)
                : prev.interests.length < 6 ? [...prev.interests, interest] : prev.interests;
            return { ...prev, interests };
        });
    };

    const handleUpdate = async (final = false) => {
        try {
            // Combine prompts into bio for final submission
            const submitData = final ? {
                ...formData,
                bio: formData.prompts.map(p => p.answer).filter(a => a.trim()).join('\n\n'),
                finalStep: final
            } : {
                ...formData,
                finalStep: final
            };

            const data = await authService.updateOnboarding(token, submitData);
            if (final) {
                onComplete(data.user);
            } else {
                nextStep();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div
                        key="step1"
                        className="onboarding-step"
                    >
                        <h2 className="onboarding-title">Nice to meet you. <br />What's your name?</h2>
                        <div className="auth-input-group">
                            <label>First Name</label>
                            <input
                                type="text"
                                className="auth-input"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex. Alex"
                                autoFocus
                            />
                        </div>
                        <div className="auth-input-group">
                            <label>Birthday</label>
                            <input
                                type="date"
                                className="auth-input"
                                value={formData.dob}
                                onChange={e => setFormData({ ...formData, dob: e.target.value })}
                            />
                        </div>
                        <button className="auth-submit-btn" onClick={() => handleUpdate()}>
                            Continue <ChevronRight size={20} />
                        </button>
                    </div>
                );
            case 2:
                return (
                    <div
                        key="step2"
                        className="onboarding-step"
                    >
                        <h2 className="onboarding-title">Who are you <br />looking for?</h2>
                        <div className="auth-input-group">
                            <label>I am a...</label>
                            <select
                                className="auth-input"
                                value={formData.gender}
                                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                            >
                                <option value="woman">Woman</option>
                                <option value="man">Man</option>
                                <option value="non-binary">Non-binary</option>
                            </select>
                        </div>
                        <div className="auth-input-group">
                            <label>Interested in...</label>
                            <select
                                className="auth-input"
                                value={formData.interestedIn}
                                onChange={e => setFormData({ ...formData, interestedIn: e.target.value })}
                            >
                                <option value="men">Men</option>
                                <option value="women">Women</option>
                                <option value="everyone">Everyone</option>
                            </select>
                        </div>
                        <div className="onboarding-nav">
                            <button className="back-btn" onClick={prevStep}><ChevronLeft size={24} /></button>
                            <button className="auth-submit-btn" onClick={() => handleUpdate()}>Continue</button>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div
                        key="step3"
                        className="onboarding-step"
                    >
                        <h2 className="onboarding-title">What are you <br />into?</h2>
                        <p className="onboarding-hint">Select up to 6 interests to find your match.</p>
                        <div className="interests-grid">
                            {INTERESTS_OPTIONS.map(interest => (
                                <button
                                    key={interest}
                                    className={`interest-item ${formData.interests.includes(interest) ? 'active' : ''}`}
                                    onClick={() => toggleInterest(interest)}
                                >
                                    {interest}
                                    {formData.interests.includes(interest) && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                        <div className="onboarding-nav">
                            <button className="back-btn" onClick={prevStep}><ChevronLeft size={24} /></button>
                            <button className="auth-submit-btn" onClick={() => handleUpdate()} disabled={formData.interests.length === 0}>
                                Continue
                            </button>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div
                        key="step4"
                        className="onboarding-step"
                    >
                        <h2 className="onboarding-title">Let's break <br />the ice.</h2>
                        <div className="auth-input-group">
                            <label>{formData.prompts[0].question}</label>
                            <textarea
                                className="auth-input"
                                value={formData.prompts[0].answer}
                                onChange={e => {
                                    const newPrompts = [...formData.prompts];
                                    newPrompts[0].answer = e.target.value;
                                    setFormData({ ...formData, prompts: newPrompts });
                                }}
                                placeholder="Share something fun..."
                            />
                        </div>
                        <div className="auth-input-group">
                            <label>{formData.prompts[1].question}</label>
                            <textarea
                                className="auth-input"
                                value={formData.prompts[1].answer}
                                onChange={e => {
                                    const newPrompts = [...formData.prompts];
                                    newPrompts[1].answer = e.target.value;
                                    setFormData({ ...formData, prompts: newPrompts });
                                }}
                                placeholder="Tell us what you love..."
                            />
                        </div>
                        <div className="onboarding-nav">
                            <button className="back-btn" onClick={prevStep}><ChevronLeft size={24} /></button>
                            <button className="auth-submit-btn" onClick={() => handleUpdate()}>Continue</button>
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div
                        key="step5"
                        className="onboarding-step"
                    >
                        <h2 className="onboarding-title">Add your <br />best shots.</h2>
                        <p className="onboarding-hint">Upload at least 1 photo and 1 video to proceed.</p>

                        <div className="media-upload-section">
                            <h3>Photos</h3>
                            <div className="photo-grid">
                                {formData.photos.map((photo, i) => (
                                    <div key={i} className="photo-slot has-content">
                                        <img src={`${getMediaBaseUrl()}${photo}`} alt={`Uploaded photo ${i + 1}`} />
                                        <button
                                            className="remove-media-btn"
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                photos: prev.photos.filter((_, idx) => idx !== i)
                                            }))}
                                            type="button"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                                {Array.from({ length: Math.max(0, 4 - formData.photos.length) }).map((_, i) => (
                                    <label
                                        key={`upload-${i}`}
                                        className="photo-slot upload-btn"
                                        style={{ opacity: uploading === 'photo' ? 0.6 : 1 }}
                                    >
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/webp"
                                            onChange={e => handleFileChange(e, 'photo')}
                                            style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' }}
                                        />
                                        {uploading === 'photo' ? <div className="spinner"></div> : <Camera size={28} />}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="media-upload-section">
                            <h3>Videos</h3>
                            <p className="upload-hint">Max 30 seconds • Up to 100MB</p>
                            <div className="photo-grid">
                                {formData.videos.map((video, i) => (
                                    <div key={i} className="photo-slot has-content">
                                        <video src={`${getMediaBaseUrl()}${video}`} controls />
                                        <button
                                            className="remove-media-btn"
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                videos: prev.videos.filter((_, idx) => idx !== i)
                                            }))}
                                            type="button"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                                {Array.from({ length: Math.max(0, 2 - formData.videos.length) }).map((_, i) => (
                                    <label
                                        key={`upload-video-${i}`}
                                        className="photo-slot upload-btn"
                                        style={{
                                            opacity: (uploading === 'video' || validating === 'video') ? 0.6 : 1,
                                            pointerEvents: (uploading === 'video' || validating === 'video') ? 'none' : 'auto'
                                        }}
                                        onClick={(e) => {
                                            if (uploading === 'video') return;
                                            const input = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
                                            input?.click();
                                        }}
                                    >
                                        <input
                                            type="file"
                                            accept="video/mp4,video/quicktime,video/mov"
                                            onChange={e => handleFileChange(e, 'video')}
                                            style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' }}
                                        />
                                        {uploading === 'video' ? (
                                            <div className="upload-progress">
                                                <div className="spinner"></div>
                                                <span className="progress-text">Processing...</span>
                                            </div>
                                        ) : validating === 'video' ? (
                                            <div className="upload-progress">
                                                <div className="spinner"></div>
                                                <span className="progress-text">Validating...</span>
                                            </div>
                                        ) : (
                                            <Sparkles size={28} />
                                        )}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="onboarding-nav">
                            <button className="back-btn" onClick={prevStep}><ChevronLeft size={24} /></button>
                            <button className="auth-submit-btn" onClick={() => handleUpdate(true)} disabled={formData.photos.length < 1 || formData.videos.length < 1}>
                                Finish <Sparkles size={20} />
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="auth-container">
            <div className="onboarding-card auth-card">
                <div className="progress-header">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${(step / 5) * 100}%`, transition: 'width 0.5s ease-out' }}
                        />
                    </div>
                </div>
                {renderStep()}
            </div>
        </div>
    );
}

// Export wrapped in error boundary
export function Onboarding(props: OnboardingProps) {
    return (
        <OnboardingErrorBoundary>
            <OnboardingComponent {...props} />
        </OnboardingErrorBoundary>
    );
}
