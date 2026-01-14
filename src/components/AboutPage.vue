<template>
    <div class="about-page">
        <div class="about-content">
            <div class="about-header">
                <h1 class="about-title">About</h1>
            </div>

            <div v-if="loading" class="about-loading">
                <div class="loading-spinner"></div>
                <p>Loading...</p>
            </div>

            <div v-else-if="projectInfo" class="about-details">
                <!-- Project Section -->
                <div class="detail-section">
                    <h2 class="section-title">Project</h2>
                    <div class="detail-item">
                        <span class="detail-label">Name</span>
                        <span class="detail-value">{{ projectInfo.name }}</span>
                    </div>
                    <div v-if="projectInfo.website" class="detail-item">
                        <span class="detail-label">Website</span>
                        <a :href="projectInfo.website" target="_blank" rel="noopener noreferrer" class="detail-value link">
                            {{ projectInfo.website }}
                        </a>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Version</span>
                        <span class="detail-value">{{ projectInfo.version }}</span>
                    </div>
                </div>

                <!-- Developer Section -->
                <div class="detail-section">
                    <h2 class="section-title">Developer</h2>
                    <div class="detail-item">
                        <span class="detail-label">Name</span>
                        <span class="detail-value">{{ projectInfo.developer.name }}</span>
                    </div>
                    <div v-if="projectInfo.developer.website" class="detail-item">
                        <span class="detail-label">Website</span>
                        <a :href="projectInfo.developer.website" target="_blank" rel="noopener noreferrer" class="detail-value link">
                            {{ projectInfo.developer.website }}
                        </a>
                    </div>
                    <div v-if="projectInfo.developer.github" class="detail-item">
                        <span class="detail-label">GitHub</span>
                        <a :href="projectInfo.developer.github" target="_blank" rel="noopener noreferrer" class="detail-value link">
                            {{ projectInfo.developer.github }}
                        </a>
                    </div>
                </div>

                <!-- Donors Section -->
                <div v-if="projectInfo.donors && projectInfo.donors.length > 0" class="detail-section">
                    <h2 class="section-title">Donors</h2>
                    <div class="donors-container">
                        <div v-for="donor in projectInfo.donors" :key="getUserId(donor.id)" class="donor-item" @click="openUserProfile(donor)">
                            <div class="donor-avatar-wrapper">
                                <img :src="getAvatarUrl(getUserId(donor.id))" :alt="donor.username" class="donor-avatar" />
                                <DonorBadgeIcon class="donor-badge" />
                            </div>
                            <div class="donor-info">
                                <div class="donor-username">{{ donor.username }}</div>
                                <div class="donor-amount">¥{{ formatDonationAmount(donor.donationAmount) }}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Donation Section -->
                <div v-if="projectInfo.donation.wechatQrCode || projectInfo.donation.alipayQrCode" class="detail-section">
                    <h2 class="section-title">Donation</h2>
                    <div class="donation-container">
                        <div v-if="projectInfo.donation.wechatQrCode" class="donation-item">
                            <div class="donation-label">WeChat Pay</div>
                            <img :src="projectInfo.donation.wechatQrCode" alt="WeChat Pay QR Code" class="donation-qr" />
                        </div>
                        <div v-if="projectInfo.donation.alipayQrCode" class="donation-item">
                            <div class="donation-label">Alipay</div>
                            <img :src="projectInfo.donation.alipayQrCode" alt="Alipay QR Code" class="donation-qr" />
                        </div>
                    </div>
                </div>

                <div class="action-section">
                    <button class="action-button secondary" @click="goBack">
                        <ArrowLeftIcon />
                        <span>Back</span>
                    </button>
                </div>
            </div>

            <div v-else class="about-error">
                <p>Failed to load project information</p>
                <button class="action-button secondary" @click="goBack">
                    <ArrowLeftIcon />
                    <span>Back</span>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchProjectInfo } from '@/services/api';
import { useUIStore } from '@/stores';
import type { ProjectInfo } from '@/types';
import ArrowLeftIcon from './icons/ArrowLeftIcon.vue';
import DonorBadgeIcon from './icons/DonorBadgeIcon.vue';

const uiStore = useUIStore();
const loading = ref(true);
const projectInfo = ref<ProjectInfo | null>(null);

onMounted(async () =>
{
    await loadProjectInfo();
});

async function loadProjectInfo()
{
    loading.value = true;
    try
    {
        const info = await fetchProjectInfo();
        projectInfo.value = info;
        loading.value = false;
    }
    catch (error)
    {
        console.error('Failed to load project info:', error);
        loading.value = false;
    }
}

function goBack()
{
    history.back();
}

function getUserId(userId: number | { value: number; }): number
{
    return typeof userId === 'object' ? userId.value : userId;
}

function getAvatarUrl(userId: number): string
{
    return `/api/user/${userId}/avatar`;
}

function openUserProfile(user: any)
{
    const uid = getUserId(user.id);
    uiStore.navigateToProfile(uid);
}

function formatDonationAmount(cents: number): string
{
    const yuan = cents / 100;
    return yuan.toFixed(2);
}
</script>

<style scoped>
.about-page {
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1 0 100%;
    overflow-y: auto;
    overflow-x: hidden;
}

.about-content {
    flex: 1;
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
}

.about-header {
    margin-bottom: 24px;
    text-align: center;
}

.about-title {
    font-size: 32px;
    font-weight: 600;
    color: var(--text-color);
    margin: 0;
}

.detail-section {
    background-color: var(--input-bg);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
    border: 1px solid var(--border-color);
}

.section-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 16px 0;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--primary-color);
}

.detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-color);
}

.detail-item:last-child {
    border-bottom: none;
}

.detail-label {
    font-weight: 500;
    color: var(--secondary-color);
    flex-shrink: 0;
}

.detail-value {
    color: var(--text-color);
    text-align: right;
    word-break: break-word;
}

.detail-value.link {
    color: var(--primary-color);
    text-decoration: none;
    transition: color 0.2s;
}

.detail-value.link:hover {
    color: var(--primary-hover);
    text-decoration: underline;
}

.donation-container {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    justify-content: center;
}

.donation-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}

.donation-label {
    font-weight: 500;
    color: var(--secondary-color);
    font-size: 16px;
}

.donation-qr {
    width: 200px;
    height: 200px;
    border-radius: 12px;
    object-fit: contain;
    background-color: var(--input-bg);
    border: 1px solid var(--border-color);
}

.donors-note {
    text-align: center;
    color: var(--secondary-color);
    font-size: 14px;
    font-style: italic;
    margin-bottom: 16px;
}

.donors-container {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: center;
}

.donor-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 100px;
    flex: 1 1 100px;
    overflow: hidden;
}

.donor-item:hover {
    background-color: var(--hover-bg);
}

.donor-avatar-wrapper {
    position: relative;
    flex-shrink: 0;
}

.donor-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border-color);
}

.donor-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 22px;
    height: 22px;
}

.donor-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
}

.donor-username {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color);
    text-align: left;
}

.donor-amount {
    font-size: 12px;
    color: var(--primary-color);
    font-weight: 600;
    text-align: left;
}

.action-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 20px;
}

.action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.action-button.secondary {
    background-color: var(--input-bg);
    color: var(--text-color);
    border: 1px solid var(--border-color);
}

.action-button.secondary:hover {
    background-color: var(--hover-bg);
    border-color: var(--primary-color);
}

.about-loading,
.about-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
}

.about-loading p,
.about-error p {
    margin-top: 16px;
    color: var(--secondary-color);
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 600px) {
    .about-content {
        padding: 16px;
    }

    .about-title {
        font-size: 28px;
    }

    .detail-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }

    .detail-value {
        text-align: left;
    }

    .donation-qr {
        width: 150px;
        height: 150px;
    }
}
</style>
